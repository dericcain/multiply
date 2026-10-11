-- Opening balances preserve the XP visible at migration time. Truncated session
-- history cannot establish every historical first mastery; only current mastery
-- is marked as already awarded. Raw family JSON and historical games are kept.
-- These ledger tables stay untracked in Hasura. Only the existing authenticated
-- family RPC writes them. Each family row lock serializes initialization, parent
-- range changes, membership changes, answers, and their receipts in one transaction.
-- load/save snapshots add data.xp (player ID -> lifetime integer) and
-- data.awardedFacts (player ID -> array of ordered fact IDs, such as "2x3").
-- save_session adds award: sessionId, playerId, answerXp, masteryXp, totalXp,
-- masteredFacts, balanceAfter, legacy. Retries return the original award and a
-- current snapshot. Legacy receipts return a zero award with balanceAfter=null.
-- New families start with one editable student; additional players remain an
-- explicit parent action, so the solo progression path works from first use.
ALTER TABLE public.multiply_families ALTER COLUMN data SET DEFAULT '{"players":[{"id":"student","name":"Student","maxTable":5,"maxMultiplier":5}],"stats":{},"sessions":[]}'::jsonb;

CREATE TABLE public.multiply_player_xp (
  family_id uuid NOT NULL REFERENCES public.multiply_families(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  opening_xp bigint NOT NULL CHECK (opening_xp >= 0),
  earned_xp bigint NOT NULL DEFAULT 0 CHECK (earned_xp >= 0),
  PRIMARY KEY (family_id, player_id)
);
CREATE TABLE public.multiply_first_mastery_awards (
  family_id uuid NOT NULL REFERENCES public.multiply_families(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  fact text NOT NULL,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, player_id, fact),
  FOREIGN KEY (family_id, player_id) REFERENCES public.multiply_player_xp(family_id, player_id) ON DELETE CASCADE
);
ALTER TABLE public.multiply_family_game_receipts ADD COLUMN award jsonb;

CREATE FUNCTION public.multiply_fact_mastered(stat jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT jsonb_array_length(coalesce(stat->'recent', '[]'::jsonb)) >= 5
    AND (SELECT count(*) FILTER (WHERE value = 'true'::jsonb) * 5 >= count(*) * 4
      FROM jsonb_array_elements(coalesce(stat->'recent', '[]'::jsonb)))
$$;
CREATE FUNCTION public.multiply_seed_xp(fid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE player jsonb; t integer; m integer; stat jsonb; total bigint; fresh integer;
BEGIN
  -- Caller holds the family row lock. The player PK makes initialization permanent.
  FOR player IN SELECT p.value FROM public.multiply_families f, LATERAL jsonb_array_elements(coalesce(f.data->'players', '[]'::jsonb)) p WHERE f.id = fid LOOP
    IF EXISTS (SELECT 1 FROM public.multiply_player_xp WHERE family_id = fid AND player_id = player->>'id') THEN CONTINUE; END IF;
    total := 0;
    FOR t IN 1..15 LOOP FOR m IN 1..15 LOOP
      SELECT data->'stats'->(player->>'id' || ':' || t || 'x' || m) INTO stat FROM public.multiply_families WHERE id = fid;
      total := total + coalesce((stat->>'correct')::bigint, 0) + CASE WHEN public.multiply_fact_mastered(stat) THEN 25 ELSE 0 END;
    END LOOP; END LOOP;
    INSERT INTO public.multiply_player_xp(family_id, player_id, opening_xp) VALUES (fid, player->>'id', total) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS fresh = ROW_COUNT;
    IF fresh = 1 THEN
      FOR t IN 1..15 LOOP FOR m IN 1..15 LOOP
        SELECT data->'stats'->(player->>'id' || ':' || t || 'x' || m) INTO stat FROM public.multiply_families WHERE id = fid;
        IF public.multiply_fact_mastered(stat) THEN
          INSERT INTO public.multiply_first_mastery_awards(family_id, player_id, fact) VALUES (fid, player->>'id', t || 'x' || m) ON CONFLICT DO NOTHING;
        END IF;
      END LOOP; END LOOP;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.multiply_seed_xp(uuid) FROM PUBLIC;
DO $$ DECLARE family_id uuid; BEGIN
  FOR family_id IN SELECT id FROM public.multiply_families FOR UPDATE LOOP PERFORM public.multiply_seed_xp(family_id); END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.multiply_family_snapshot(family_id uuid, requesting_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT jsonb_build_object(
    'userId', requesting_user,
    'family', jsonb_build_object('id', f.id, 'ownerId', f.owner_id),
    'families', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', ff.id, 'ownerId', ff.owner_id, 'label', u.email) ORDER BY ff.created_at, ff.id), '[]'::jsonb)
      FROM public.multiply_family_members m JOIN public.multiply_families ff ON ff.id = m.family_id JOIN auth.users u ON u.id = ff.owner_id WHERE m.user_id = requesting_user),
    'data', f.data || jsonb_build_object(
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

CREATE OR REPLACE FUNCTION public.multiply_family_action(action text, payload jsonb, hasura_session json)
RETURNS SETOF public.multiply_family_action_results
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
<<xp_action>>
DECLARE
  actor uuid;
  actor_email text;
  verified boolean;
  fid uuid;
  family public.multiply_families%ROWTYPE;
  invite public.multiply_family_invitations%ROWTYPE;
  secret text;
  invited_email text;
  member_id uuid;
  player jsonb;
  game jsonb;
  answer jsonb;
  old_stat jsonb;
  recent jsonb;
  stats jsonb;
  players jsonb;
  sessions jsonb;
  fact text;
  correct_count integer := 0;
  attempts integer;
  score numeric;
  table_number integer;
  multiplier integer;
  outcome boolean;
  affected integer;
  response jsonb;
  award jsonb;
  new_mastery jsonb := '[]'::jsonb;
  mastery_count integer := 0;
  balance bigint;
  fact_id text;
BEGIN
  IF hasura_session->>'x-hasura-role' IS DISTINCT FROM 'user' OR nullif(hasura_session->>'x-hasura-user-id', '') IS NULL THEN
    RAISE EXCEPTION 'Sign in to access your family' USING ERRCODE = '42501';
  END IF;
  actor := (hasura_session->>'x-hasura-user-id')::uuid;
  SELECT lower(email), email_verified INTO actor_email, verified FROM auth.users WHERE id = actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sign in to access your family' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE = '22023'; END IF;

  IF action = 'load' THEN
    -- One permanent owned family per login; invitations never merge or erase it.
    PERFORM pg_advisory_xact_lock(hashtextextended(actor::text, 0));
    INSERT INTO public.multiply_families (owner_id, data)
    SELECT actor, data FROM public.multiply_profiles WHERE user_id = actor
    ON CONFLICT (owner_id) DO NOTHING;
    INSERT INTO public.multiply_families (owner_id) VALUES (actor) ON CONFLICT (owner_id) DO NOTHING;
    INSERT INTO public.multiply_family_members (family_id, user_id)
    SELECT id, actor FROM public.multiply_families WHERE owner_id = actor ON CONFLICT DO NOTHING;
    SELECT coalesce(nullif(payload->>'familyId', '')::uuid, id) INTO fid FROM public.multiply_families WHERE owner_id = actor;
  ELSIF action = 'accept_invitation' THEN
    SELECT family_id INTO fid FROM public.multiply_family_invitations
    WHERE token_hash = sha256(convert_to(coalesce(payload->>'token', ''), 'UTF8'));
    IF NOT FOUND THEN RAISE EXCEPTION 'Invitation unavailable or expired' USING ERRCODE = '22023'; END IF;
  ELSE
    fid := nullif(payload->>'familyId', '')::uuid;
  END IF;

  -- Serialize every operation with membership removal and other family writes.
  SELECT * INTO family FROM public.multiply_families WHERE id = fid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Family access denied' USING ERRCODE = '42501'; END IF;

  IF action = 'accept_invitation' THEN
    SELECT * INTO invite FROM public.multiply_family_invitations
    WHERE family_id = fid AND token_hash = sha256(convert_to(coalesce(payload->>'token', ''), 'UTF8')) FOR UPDATE;
    IF NOT FOUND OR invite.revoked_at IS NOT NULL OR invite.accepted_at IS NOT NULL OR invite.expires_at <= now() THEN
      RAISE EXCEPTION 'Invitation unavailable or expired' USING ERRCODE = '22023';
    END IF;
    IF NOT coalesce(verified, false) OR actor_email IS DISTINCT FROM invite.email THEN
      RAISE EXCEPTION 'Sign in with the verified invited email address' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.multiply_family_members (family_id, user_id) VALUES (fid, actor) ON CONFLICT DO NOTHING;
    UPDATE public.multiply_family_invitations SET accepted_at = now(), accepted_by = actor WHERE id = invite.id;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.multiply_family_members WHERE family_id = fid AND user_id = actor) THEN
      RAISE EXCEPTION 'Family access denied' USING ERRCODE = '42501';
    END IF;
    IF action IN ('invite', 'cancel_invitation', 'remove_member') AND family.owner_id <> actor THEN
      RAISE EXCEPTION 'Only the family owner can manage parents' USING ERRCODE = '42501';
    END IF;

    PERFORM public.multiply_seed_xp(fid);
    CASE action
    WHEN 'load' THEN NULL;
    WHEN 'invite' THEN
      invited_email := lower(btrim(payload->>'email'));
      IF invited_email IS NULL OR length(invited_email) > 254 OR invited_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
        RAISE EXCEPTION 'Enter a valid email address' USING ERRCODE = '22023';
      END IF;
      IF EXISTS (SELECT 1 FROM public.multiply_family_members m JOIN auth.users u ON u.id = m.user_id WHERE m.family_id = fid AND lower(u.email) = invited_email) THEN
        RAISE EXCEPTION 'That parent already belongs to this family' USING ERRCODE = '22023';
      END IF;
      UPDATE public.multiply_family_invitations SET revoked_at = now()
      WHERE family_id = fid AND email = invited_email AND accepted_at IS NULL AND revoked_at IS NULL;
      secret := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
      INSERT INTO public.multiply_family_invitations (family_id, email, token_hash)
      VALUES (fid, invited_email, sha256(convert_to(secret, 'UTF8'))) RETURNING * INTO invite;
      response := jsonb_build_object('id', invite.id, 'email', invite.email, 'expiresAt', invite.expires_at, 'token', secret);
    WHEN 'cancel_invitation' THEN
      UPDATE public.multiply_family_invitations SET revoked_at = now()
      WHERE id = nullif(payload->>'invitationId', '')::uuid AND family_id = fid AND accepted_at IS NULL;
    WHEN 'remove_member' THEN
      member_id := nullif(payload->>'userId', '')::uuid;
      IF member_id IS NULL OR member_id = actor OR member_id = family.owner_id THEN
        RAISE EXCEPTION 'The family owner cannot be removed' USING ERRCODE = '22023';
      END IF;
      -- Also invalidate any older unaccepted links for the removed parent.
      UPDATE public.multiply_family_invitations SET revoked_at = now()
      WHERE family_id = fid AND email = (SELECT lower(email) FROM auth.users WHERE id = member_id) AND accepted_at IS NULL AND revoked_at IS NULL;
      DELETE FROM public.multiply_family_members WHERE family_id = fid AND user_id = member_id;
    WHEN 'save_player' THEN
      player := payload->'player';
      IF jsonb_typeof(player) IS DISTINCT FROM 'object' OR nullif(btrim(player->>'id'), '') IS NULL OR length(player->>'id') > 128
        OR nullif(btrim(player->>'name'), '') IS NULL OR length(player->>'name') > 80
        OR coalesce(player->>'maxTable', '') !~ '^[0-9]+$' OR coalesce(player->>'maxMultiplier', '') !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'Invalid player settings' USING ERRCODE = '22023';
      END IF;
      IF (player->>'maxTable')::numeric NOT BETWEEN 1 AND 15 OR (player->>'maxMultiplier')::numeric NOT BETWEEN 1 AND 15 THEN
        RAISE EXCEPTION 'Player ranges must be between 1 and 15' USING ERRCODE = '22023';
      END IF;
      player := jsonb_build_object('id', player->>'id', 'name', btrim(player->>'name'), 'maxTable', (player->>'maxTable')::integer, 'maxMultiplier', (player->>'maxMultiplier')::integer);
      SELECT coalesce(jsonb_agg(CASE WHEN p.value->>'id' = player->>'id' THEN player ELSE p.value END ORDER BY p.ordinality), '[]'::jsonb)
      INTO players FROM jsonb_array_elements(coalesce(family.data->'players', '[]'::jsonb)) WITH ORDINALITY p;
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(players) p WHERE p->>'id' = player->>'id') THEN players := players || jsonb_build_array(player); END IF;
      UPDATE public.multiply_families SET data = jsonb_set(data, '{players}', players), updated_at = now() WHERE id = fid;
    WHEN 'save_session' THEN
      game := payload->'gameSession';
      IF jsonb_typeof(game) IS DISTINCT FROM 'object' OR nullif(game->>'id', '') IS NULL OR length(game->>'id') > 128
        OR game->>'mode' NOT IN ('practice', 'challenge') OR game->>'mode' IS NULL
        OR game->>'answerMode' NOT IN ('choice', 'type') OR game->>'answerMode' IS NULL
        OR jsonb_typeof(game->'results') IS DISTINCT FROM 'array'
        OR coalesce(game->>'table', '') !~ '^[0-9]+$' OR coalesce(game->>'maxMultiplier', '') !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'Invalid game results' USING ERRCODE = '22023';
      END IF;
      attempts := jsonb_array_length(game->'results');
      IF attempts NOT BETWEEN 1 AND 10000 OR (game->>'table')::numeric NOT BETWEEN 1 AND 15 OR (game->>'maxMultiplier')::numeric NOT BETWEEN 1 AND 15 THEN
        RAISE EXCEPTION 'Invalid game range or length' USING ERRCODE = '22023';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(family.data->'players', '[]'::jsonb)) p WHERE p->>'id' = game->>'playerId') THEN
        RAISE EXCEPTION 'That player is no longer available' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.multiply_family_game_receipts (family_id, session_id) VALUES (fid, game->>'id') ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF affected = 0 THEN
        SELECT r.award INTO award FROM public.multiply_family_game_receipts r WHERE r.family_id = fid AND r.session_id = game->>'id';
        RETURN QUERY SELECT actor, public.multiply_family_snapshot(fid, actor) || jsonb_build_object('award', coalesce(award,
          jsonb_build_object('sessionId', game->>'id', 'playerId', game->>'playerId', 'answerXp', 0, 'masteryXp', 0, 'totalXp', 0,
            'masteredFacts', '[]'::jsonb, 'balanceAfter', NULL, 'legacy', true)));
        RETURN;
      END IF;
      stats := coalesce(family.data->'stats', '{}'::jsonb);
      FOR answer IN SELECT value FROM jsonb_array_elements(game->'results') LOOP
        IF jsonb_typeof(answer) IS DISTINCT FROM 'object' OR coalesce(answer->>'table', '') !~ '^[0-9]+$'
          OR coalesce(answer->>'multiplier', '') !~ '^[0-9]+$' OR jsonb_typeof(answer->'correct') IS DISTINCT FROM 'boolean' THEN
          RAISE EXCEPTION 'Invalid answer results' USING ERRCODE = '22023';
        END IF;
        IF (answer->>'table')::numeric NOT BETWEEN 1 AND 15 OR (answer->>'multiplier')::numeric NOT BETWEEN 1 AND 15 THEN
          RAISE EXCEPTION 'Invalid answer range' USING ERRCODE = '22023';
        END IF;
        table_number := (answer->>'table')::integer; multiplier := (answer->>'multiplier')::integer; outcome := (answer->>'correct')::boolean;
        IF table_number <> (game->>'table')::integer OR multiplier > (game->>'maxMultiplier')::integer THEN
          RAISE EXCEPTION 'Answer does not match the game range' USING ERRCODE = '22023';
        END IF;
        correct_count := correct_count + CASE WHEN outcome THEN 1 ELSE 0 END;
        fact := game->>'playerId' || ':' || table_number || 'x' || multiplier;
        old_stat := coalesce(stats->fact, '{"attempts":0,"correct":0,"recent":[]}'::jsonb);
        SELECT coalesce(jsonb_agg(r.value ORDER BY r.ordinality), '[]'::jsonb) INTO recent
        FROM jsonb_array_elements(coalesce(old_stat->'recent', '[]'::jsonb) || jsonb_build_array(outcome)) WITH ORDINALITY r
        WHERE r.ordinality > jsonb_array_length(coalesce(old_stat->'recent', '[]'::jsonb)) + 1 - 10;
        stats := jsonb_set(stats, ARRAY[fact], jsonb_build_object('attempts', coalesce((old_stat->>'attempts')::integer, 0) + 1,
          'correct', coalesce((old_stat->>'correct')::integer, 0) + CASE WHEN outcome THEN 1 ELSE 0 END, 'recent', recent));
        IF public.multiply_fact_mastered(jsonb_build_object('recent', recent)) THEN
          fact_id := table_number || 'x' || multiplier;
          INSERT INTO public.multiply_first_mastery_awards (family_id, player_id, fact, session_id)
          VALUES (fid, game->>'playerId', fact_id, game->>'id') ON CONFLICT DO NOTHING;
          GET DIAGNOSTICS affected = ROW_COUNT;
          IF affected = 1 THEN mastery_count := mastery_count + 1; new_mastery := new_mastery || jsonb_build_array(fact_id); END IF;
        END IF;
      END LOOP;
      IF game->>'mode' = 'challenge' THEN
        IF attempts > (game->>'maxMultiplier')::integer OR EXISTS (SELECT 1 FROM jsonb_array_elements(game->'results') r GROUP BY r->>'multiplier' HAVING count(*) > 1) THEN
          RAISE EXCEPTION 'Invalid challenge results' USING ERRCODE = '22023';
        END IF;
        score := round(correct_count::numeric / (game->>'maxMultiplier')::integer * CASE WHEN game->>'answerMode' = 'type' THEN 125 ELSE 100 END);
      ELSE score := NULL; END IF;
      UPDATE public.multiply_player_xp SET earned_xp = earned_xp + correct_count + mastery_count * 25
      WHERE family_id = fid AND player_id = game->>'playerId' RETURNING opening_xp + earned_xp INTO balance;
      award := jsonb_build_object('sessionId', game->>'id', 'playerId', game->>'playerId', 'answerXp', correct_count,
        'masteryXp', mastery_count * 25, 'totalXp', correct_count + mastery_count * 25, 'masteredFacts', new_mastery,
        'balanceAfter', balance, 'legacy', false);
      UPDATE public.multiply_family_game_receipts SET award = xp_action.award WHERE family_id = fid AND session_id = game->>'id';
      game := jsonb_build_object('id', game->>'id', 'playerId', game->>'playerId', 'mode', game->>'mode', 'answerMode', game->>'answerMode',
        'table', (game->>'table')::integer, 'maxMultiplier', (game->>'maxMultiplier')::integer, 'correct', correct_count, 'attempts', attempts,
        'percentage', round(correct_count::numeric / attempts * 100), 'score', score, 'date', floor(extract(epoch FROM clock_timestamp()) * 1000), 'results', game->'results');
      SELECT coalesce(jsonb_agg(s.value ORDER BY s.ordinality), '[]'::jsonb) INTO sessions
      FROM jsonb_array_elements(coalesce(family.data->'sessions', '[]'::jsonb) || jsonb_build_array(game)) WITH ORDINALITY s
      WHERE s.ordinality > jsonb_array_length(coalesce(family.data->'sessions', '[]'::jsonb)) + 1 - 200;
      UPDATE public.multiply_families SET data = jsonb_set(jsonb_set(data, '{stats}', stats), '{sessions}', sessions), updated_at = now() WHERE id = fid;
    ELSE RAISE EXCEPTION 'Unknown family action' USING ERRCODE = '22023';
    END CASE;
  END IF;
  PERFORM public.multiply_seed_xp(fid);
  RETURN QUERY SELECT actor, coalesce(response, public.multiply_family_snapshot(fid, actor) || CASE WHEN award IS NOT NULL THEN jsonb_build_object('award', award) ELSE '{}'::jsonb END);
EXCEPTION WHEN SQLSTATE '42501' OR SQLSTATE '22023' THEN
  -- Hasura suppresses database exception details in production. Return expected
  -- business errors as caller-filtered data, after this block's writes rollback.
  RETURN QUERY SELECT actor, jsonb_build_object('error', jsonb_build_object('code', SQLSTATE, 'message', SQLERRM));
END;
$$;
