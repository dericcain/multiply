-- Start tracking future saved games; no historical streaks are invented.
-- This ledger is untracked and inaccessible through direct GraphQL operations.
CREATE TABLE public.multiply_player_streaks (
  family_id uuid NOT NULL REFERENCES public.multiply_families(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  current_count integer NOT NULL DEFAULT 0,
  best_count integer NOT NULL DEFAULT 0,
  seen_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (family_id, player_id),
  CHECK (jsonb_typeof(seen_facts) = 'array' AND current_count = jsonb_array_length(seen_facts)),
  CHECK (best_count >= current_count AND current_count >= 0)
);

CREATE FUNCTION public.multiply_record_streak()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE game jsonb; answer jsonb; seen jsonb; best integer; fact text; t integer; m integer;
BEGIN
  -- The family RPC appends exactly one validated game under its family row lock.
  -- Its retained receipt prevents duplicate saves from reaching this update,
  -- even after a game is evicted from the visible 200-session history.
  game := NEW.data->'sessions'->-1;
  IF game IS NULL OR game->>'id' IS NOT DISTINCT FROM OLD.data->'sessions'->-1->>'id'
    OR NOT EXISTS (SELECT 1 FROM public.multiply_family_game_receipts WHERE family_id = NEW.id AND session_id = game->>'id' AND award IS NOT NULL) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.multiply_player_streaks(family_id, player_id)
    VALUES (NEW.id, game->>'playerId') ON CONFLICT DO NOTHING;
  SELECT seen_facts, best_count INTO seen, best FROM public.multiply_player_streaks
    WHERE family_id = NEW.id AND player_id = game->>'playerId' FOR UPDATE;
  FOR answer IN SELECT value FROM jsonb_array_elements(game->'results') LOOP
    IF NOT (answer->>'correct')::boolean THEN
      seen := '[]'::jsonb;
    ELSE
      t := (answer->>'table')::integer; m := (answer->>'multiplier')::integer;
      fact := least(t, m) || 'x' || greatest(t, m);
      IF NOT seen ? fact THEN seen := seen || jsonb_build_array(fact); END IF;
      best := greatest(best, jsonb_array_length(seen));
    END IF;
  END LOOP;
  UPDATE public.multiply_player_streaks SET seen_facts = seen, current_count = jsonb_array_length(seen), best_count = best
    WHERE family_id = NEW.id AND player_id = game->>'playerId';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.multiply_record_streak() FROM PUBLIC;
CREATE TRIGGER multiply_record_streak AFTER UPDATE OF data ON public.multiply_families
  FOR EACH ROW WHEN (OLD.data->'sessions' IS DISTINCT FROM NEW.data->'sessions') EXECUTE FUNCTION public.multiply_record_streak();

CREATE OR REPLACE FUNCTION public.multiply_family_snapshot(family_id uuid, requesting_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT jsonb_build_object(
    'userId', requesting_user,
    'family', jsonb_build_object('id', f.id, 'ownerId', f.owner_id),
    'families', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', ff.id, 'ownerId', ff.owner_id, 'label', u.email) ORDER BY ff.created_at, ff.id), '[]'::jsonb)
      FROM public.multiply_family_members m JOIN public.multiply_families ff ON ff.id = m.family_id JOIN auth.users u ON u.id = ff.owner_id WHERE m.user_id = requesting_user),
    'data', f.data || jsonb_build_object(
      'streaks', (SELECT coalesce(jsonb_object_agg(s.player_id, jsonb_build_object('current', s.current_count, 'best', s.best_count, 'seen', s.seen_facts)), '{}'::jsonb) FROM public.multiply_player_streaks s WHERE s.family_id = f.id),
      'xp', (SELECT coalesce(jsonb_object_agg(x.player_id, x.opening_xp + x.earned_xp), '{}'::jsonb) FROM public.multiply_player_xp x WHERE x.family_id = f.id),
      'awardedFacts', (SELECT coalesce(jsonb_object_agg(a.player_id, a.facts), '{}'::jsonb) FROM (
        SELECT player_id, jsonb_agg(fact ORDER BY fact) facts FROM public.multiply_first_mastery_awards WHERE family_id = f.id GROUP BY player_id
      ) a)),
    'members', (SELECT coalesce(jsonb_agg(jsonb_build_object('userId', m.user_id, 'email', u.email, 'role', CASE WHEN m.user_id = f.owner_id THEN 'owner' ELSE 'parent' END) ORDER BY m.joined_at, m.user_id), '[]'::jsonb)
      FROM public.multiply_family_members m JOIN auth.users u ON u.id = m.user_id WHERE m.family_id = f.id),
    'invitations', CASE WHEN f.owner_id = requesting_user THEN
      (SELECT coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'expiresAt', i.expires_at) ORDER BY i.created_at), '[]'::jsonb)
       FROM public.multiply_family_invitations i WHERE i.family_id = f.id AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND i.expires_at > now())
      ELSE '[]'::jsonb END)
  FROM public.multiply_families f
  WHERE f.id = family_id AND EXISTS (SELECT 1 FROM public.multiply_family_members m WHERE m.family_id = f.id AND m.user_id = requesting_user)
$$;
REVOKE ALL ON FUNCTION public.multiply_family_snapshot(uuid, uuid) FROM PUBLIC;

-- Read-only family competition summaries for valid child practice links.
CREATE OR REPLACE FUNCTION public.multiply_practice_action(action text, payload jsonb, hasura_session json)
RETURNS SETOF public.multiply_practice_action_results
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE link public.multiply_player_links%ROWTYPE; fid uuid; owner_id uuid; player jsonb; game jsonb; full_snapshot jsonb; response jsonb; stats jsonb;
BEGIN
  IF hasura_session->>'x-hasura-role' IS DISTINCT FROM 'public' THEN
    RAISE EXCEPTION 'Practice access denied' USING ERRCODE = '42501';
  END IF;
  IF coalesce(payload->>'token', '') !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'This practice link is unavailable. Ask a parent for a new link.' USING ERRCODE = '42501';
  END IF;
  SELECT family_id INTO fid FROM public.multiply_player_links WHERE token_hash = sha256(convert_to(payload->>'token', 'UTF8'));
  -- Family lock serializes reads and saves with replacement, revocation, and range edits.
  SELECT f.owner_id INTO owner_id FROM public.multiply_families f WHERE f.id = fid FOR UPDATE;
  SELECT * INTO link FROM public.multiply_player_links WHERE family_id = fid AND token_hash = sha256(convert_to(payload->>'token', 'UTF8')) AND revoked_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This practice link is unavailable. Ask a parent for a new link.' USING ERRCODE = '42501';
  END IF;
  SELECT p INTO player FROM public.multiply_families f, LATERAL jsonb_array_elements(f.data->'players') p WHERE f.id = fid AND p->>'id' = link.player_id;
  IF player IS NULL THEN RAISE EXCEPTION 'That player is no longer available' USING ERRCODE = '42501'; END IF;
  IF action = 'save_session' THEN
    game := payload->'gameSession';
    IF game->>'playerId' IS DISTINCT FROM link.player_id OR nullif(game->>'id', '') IS NULL OR length(game->>'id') > 80 THEN
      RAISE EXCEPTION 'Invalid practice player or game' USING ERRCODE = '22023';
    END IF;
    -- Isolate receipt IDs from parents and other links; retries still use the
    -- existing authoritative XP and first-mastery transaction.
    game := jsonb_set(game, '{id}', to_jsonb('child/' || link.id || '/' || (game->>'id')));
    IF NOT EXISTS (SELECT 1 FROM public.multiply_family_game_receipts WHERE family_id = fid AND session_id = game->>'id') THEN
      IF coalesce(game->>'table', '') !~ '^[0-9]+$' OR coalesce(game->>'maxMultiplier', '') !~ '^[0-9]+$'
        OR (game->>'table')::numeric NOT BETWEEN 1 AND (player->>'maxTable')::integer
        OR (game->>'maxMultiplier')::numeric NOT BETWEEN 1 AND (player->>'maxMultiplier')::integer THEN
        RAISE EXCEPTION 'Your assigned tables changed. Reload before your next round.' USING ERRCODE = '22023';
      END IF;
    END IF;
  ELSIF action <> 'load' THEN
    RAISE EXCEPTION 'Unknown practice action' USING ERRCODE = '22023';
  END IF;
  SELECT result INTO full_snapshot FROM public.multiply_family_action(action,
    jsonb_build_object('familyId', fid, 'gameSession', game),
    json_build_object('x-hasura-role', 'user', 'x-hasura-user-id', owner_id));
  IF full_snapshot ? 'error' THEN RETURN QUERY SELECT jsonb_build_object('error', full_snapshot->'error'); RETURN; END IF;
  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO stats FROM jsonb_each(full_snapshot->'data'->'stats') WHERE key IN (SELECT link.player_id || ':' || t || 'x' || m FROM generate_series(1, 15) t, generate_series(1, 15) m);
  -- Explicit allowlist: never return parent emails, other families, sibling histories,
  -- invitations, link hashes, custom profile fields, or another player's awards.
  response := jsonb_build_object('userId', link.id, 'family', jsonb_build_object('id', fid), 'data', jsonb_build_object(
    'players', jsonb_build_array(player), 'stats', stats,
    'sessions', (SELECT coalesce(jsonb_agg(s), '[]'::jsonb) FROM jsonb_array_elements(full_snapshot->'data'->'sessions') s WHERE s->>'playerId' = link.player_id),
    'streaks', jsonb_build_object(link.player_id, coalesce(full_snapshot->'data'->'streaks'->link.player_id, '{"current":0,"best":0,"seen":[]}'::jsonb)),
    'xp', jsonb_build_object(link.player_id, full_snapshot->'data'->'xp'->link.player_id),
    'awardedFacts', jsonb_build_object(link.player_id, coalesce(full_snapshot->'data'->'awardedFacts'->link.player_id, '[]'::jsonb))));
  -- Only public competition fields leave the family snapshot. Keep playable
  -- players, fact histories, sessions, and awards scoped to the linked child.
  response := response || jsonb_build_object('standings', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'player', jsonb_build_object('id', p->>'id', 'name', p->>'name',
        'maxTable', p->'maxTable', 'maxMultiplier', p->'maxMultiplier'),
      'xp', coalesce(full_snapshot->'data'->'xp'->(p->>'id'), '0'::jsonb),
      'count', progress.mastered, 'total', (p->>'maxTable')::integer * (p->>'maxMultiplier')::integer,
      'hasEvidence', progress.has_evidence
    ) ORDER BY position), '[]'::jsonb)
    FROM jsonb_array_elements(full_snapshot->'data'->'players') WITH ORDINALITY players(p, position)
    CROSS JOIN LATERAL (
      SELECT count(*) FILTER (WHERE jsonb_array_length(recent) >= 5
          AND (SELECT count(*) FROM jsonb_array_elements(recent) answer WHERE answer = 'true'::jsonb) * 5 >= jsonb_array_length(recent) * 4) AS mastered,
        coalesce(bool_or(jsonb_array_length(recent) >= 5), false) AS has_evidence
      FROM generate_series(1, (p->>'maxTable')::integer) t
      CROSS JOIN generate_series(1, (p->>'maxMultiplier')::integer) m
      CROSS JOIN LATERAL (
        SELECT CASE WHEN jsonb_typeof(full_snapshot->'data'->'stats'->((p->>'id') || ':' || t || 'x' || m)->'recent') = 'array'
          THEN full_snapshot->'data'->'stats'->((p->>'id') || ':' || t || 'x' || m)->'recent'
          ELSE '[]'::jsonb END AS recent
      ) fact
    ) progress
  ));
  IF full_snapshot ? 'award' THEN response := response || jsonb_build_object('award', full_snapshot->'award'); END IF;
  RETURN QUERY SELECT response;
EXCEPTION WHEN SQLSTATE '42501' OR SQLSTATE '22023' OR invalid_text_representation THEN
  RETURN QUERY SELECT jsonb_build_object('error', jsonb_build_object('code', SQLSTATE, 'message', SQLERRM));
END;
$$;
