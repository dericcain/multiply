-- Bearer links grant access to one player's practice only. No child auth account
-- or family membership is created. Tables remain untracked except empty RPC results.
CREATE TABLE public.multiply_player_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.multiply_families(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  token_hash bytea NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE UNIQUE INDEX multiply_player_links_active ON public.multiply_player_links(family_id, player_id) WHERE revoked_at IS NULL;
CREATE TABLE public.multiply_practice_action_results (
  result jsonb NOT NULL,
  CONSTRAINT multiply_practice_action_results_empty CHECK (false)
);

CREATE FUNCTION public.multiply_player_link_action(action text, payload jsonb, hasura_session json)
RETURNS SETOF public.multiply_family_action_results
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid; fid uuid; secret text; pid text; link public.multiply_player_links%ROWTYPE; response jsonb;
BEGIN
  IF hasura_session->>'x-hasura-role' IS DISTINCT FROM 'user' THEN
    RAISE EXCEPTION 'Sign in to manage practice links' USING ERRCODE = '42501';
  END IF;
  actor := (hasura_session->>'x-hasura-user-id')::uuid;
  fid := (payload->>'familyId')::uuid;
  PERFORM 1 FROM public.multiply_families WHERE id = fid FOR UPDATE;
  IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.multiply_family_members WHERE family_id = fid AND user_id = actor) THEN
    RAISE EXCEPTION 'Family access denied' USING ERRCODE = '42501';
  END IF;
  IF action IN ('create', 'revoke') THEN
    pid := payload->>'playerId';
    IF NOT EXISTS (SELECT 1 FROM public.multiply_families f, LATERAL jsonb_array_elements(f.data->'players') p WHERE f.id = fid AND p->>'id' = pid) THEN
      RAISE EXCEPTION 'That player is no longer available' USING ERRCODE = '22023';
    END IF;
    UPDATE public.multiply_player_links SET revoked_at = now() WHERE family_id = fid AND player_id = pid AND revoked_at IS NULL;
    IF action = 'create' THEN
      secret := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
      INSERT INTO public.multiply_player_links(family_id, player_id, token_hash) VALUES (fid, pid, sha256(convert_to(secret, 'UTF8'))) RETURNING * INTO link;
      response := jsonb_build_object('id', link.id, 'playerId', pid, 'token', secret);
    END IF;
  ELSIF action <> 'list' THEN
    RAISE EXCEPTION 'Unknown practice link action' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY SELECT actor, jsonb_build_object('link', response, 'links',
    (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'playerId', player_id, 'createdAt', created_at) ORDER BY created_at), '[]'::jsonb)
      FROM public.multiply_player_links WHERE family_id = fid AND revoked_at IS NULL));
EXCEPTION WHEN SQLSTATE '42501' OR SQLSTATE '22023' OR invalid_text_representation THEN
  RETURN QUERY SELECT actor, jsonb_build_object('error', jsonb_build_object('code', SQLSTATE, 'message', SQLERRM));
END;
$$;

CREATE FUNCTION public.multiply_practice_action(action text, payload jsonb, hasura_session json)
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
  -- Explicit allowlist: never return parent emails, other families, siblings,
  -- invitations, link hashes, custom profile fields, or another player's awards.
  response := jsonb_build_object('userId', link.id, 'family', jsonb_build_object('id', fid), 'data', jsonb_build_object(
    'players', jsonb_build_array(player), 'stats', stats,
    'sessions', (SELECT coalesce(jsonb_agg(s), '[]'::jsonb) FROM jsonb_array_elements(full_snapshot->'data'->'sessions') s WHERE s->>'playerId' = link.player_id),
    'xp', jsonb_build_object(link.player_id, full_snapshot->'data'->'xp'->link.player_id),
    'awardedFacts', jsonb_build_object(link.player_id, coalesce(full_snapshot->'data'->'awardedFacts'->link.player_id, '[]'::jsonb))));
  IF full_snapshot ? 'award' THEN response := response || jsonb_build_object('award', full_snapshot->'award'); END IF;
  RETURN QUERY SELECT response;
EXCEPTION WHEN SQLSTATE '42501' OR SQLSTATE '22023' OR invalid_text_representation THEN
  RETURN QUERY SELECT jsonb_build_object('error', jsonb_build_object('code', SQLSTATE, 'message', SQLERRM));
END;
$$;
REVOKE ALL ON FUNCTION public.multiply_player_link_action(text, jsonb, json) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.multiply_practice_action(text, jsonb, json) FROM PUBLIC;
