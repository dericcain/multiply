-- Families own their children's data independently of each parent's login.
CREATE TABLE public.multiply_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{"players":[{"id":"ethan","name":"Ethan","maxTable":15,"maxMultiplier":15},{"id":"josiah","name":"Josiah","maxTable":10,"maxMultiplier":10},{"id":"joseph","name":"Joseph","maxTable":5,"maxMultiplier":5}],"stats":{},"sessions":[]}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.multiply_family_members (
  family_id uuid NOT NULL REFERENCES public.multiply_families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, user_id)
);
CREATE INDEX multiply_family_members_user ON public.multiply_family_members(user_id);
CREATE TABLE public.multiply_family_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.multiply_families(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz
);
CREATE INDEX multiply_family_invitations_family ON public.multiply_family_invitations(family_id);
-- Receipts survive the 200-game display window, so delayed retries never double-count.
CREATE TABLE public.multiply_family_game_receipts (
  family_id uuid NOT NULL REFERENCES public.multiply_families(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, session_id)
);
-- Hasura requires a tracked table return type. This table is intentionally empty.
CREATE TABLE public.multiply_family_action_results (
  user_id uuid NOT NULL,
  result jsonb NOT NULL,
  CONSTRAINT multiply_family_action_results_empty CHECK (false)
);

-- Preserve the complete legacy JSON, including any additional profile fields.
INSERT INTO public.multiply_families (owner_id, data)
SELECT user_id, data FROM public.multiply_profiles
ON CONFLICT (owner_id) DO NOTHING;
INSERT INTO public.multiply_family_members (family_id, user_id)
SELECT id, owner_id FROM public.multiply_families ON CONFLICT DO NOTHING;
INSERT INTO public.multiply_family_game_receipts (family_id, session_id)
SELECT f.id, s.value->>'id'
FROM public.multiply_families f,
LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(f.data->'sessions') = 'array' THEN f.data->'sessions' ELSE '[]'::jsonb END) s
WHERE nullif(s.value->>'id', '') IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE FUNCTION public.multiply_family_snapshot(family_id uuid, requesting_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT jsonb_build_object(
    'userId', requesting_user,
    'family', jsonb_build_object('id', f.id, 'ownerId', f.owner_id),
    'families', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', ff.id, 'ownerId', ff.owner_id, 'label', u.email) ORDER BY ff.created_at, ff.id), '[]'::jsonb)
      FROM public.multiply_family_members m JOIN public.multiply_families ff ON ff.id = m.family_id JOIN auth.users u ON u.id = ff.owner_id WHERE m.user_id = requesting_user),
    'data', f.data,
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

CREATE FUNCTION public.multiply_family_action(action text, payload jsonb, hasura_session json)
RETURNS SETOF public.multiply_family_action_results
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
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
      IF affected = 0 THEN RETURN QUERY SELECT actor, public.multiply_family_snapshot(fid, actor); RETURN; END IF;
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
      END LOOP;
      IF game->>'mode' = 'challenge' THEN
        IF attempts > (game->>'maxMultiplier')::integer OR EXISTS (SELECT 1 FROM jsonb_array_elements(game->'results') r GROUP BY r->>'multiplier' HAVING count(*) > 1) THEN
          RAISE EXCEPTION 'Invalid challenge results' USING ERRCODE = '22023';
        END IF;
        score := round(correct_count::numeric / (game->>'maxMultiplier')::integer * CASE WHEN game->>'answerMode' = 'type' THEN 125 ELSE 100 END);
      ELSE score := NULL; END IF;
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
  RETURN QUERY SELECT actor, coalesce(response, public.multiply_family_snapshot(fid, actor));
EXCEPTION WHEN SQLSTATE '42501' OR SQLSTATE '22023' THEN
  -- Hasura suppresses database exception details in production. Return expected
  -- business errors as caller-filtered data, after this block's writes rollback.
  RETURN QUERY SELECT actor, jsonb_build_object('error', jsonb_build_object('code', SQLSTATE, 'message', SQLERRM));
END;
$$;
