-- Run against a disposable database with the migration and minimal auth fixture.
BEGIN;
CREATE FUNCTION pg_temp.assert_that(ok boolean, detail text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', detail; END IF; END $$;
CREATE FUNCTION pg_temp.call_family(operation text, body jsonb, actor uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE response jsonb;
BEGIN
  SELECT result INTO response FROM public.multiply_family_action(operation, body, json_build_object('x-hasura-role', 'user', 'x-hasura-user-id', actor));
  IF response ? 'error' THEN RAISE EXCEPTION '%', response->'error'->>'message' USING ERRCODE = response->'error'->>'code'; END IF;
  RETURN response;
END $$;
CREATE FUNCTION pg_temp.expect_error(operation text, body jsonb, actor uuid, expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE message text;
BEGIN
  BEGIN
    PERFORM pg_temp.call_family(operation, body, actor);
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS message = MESSAGE_TEXT;
    IF position(expected IN message) = 0 THEN RAISE EXCEPTION 'Wrong error: % (wanted %)', message, expected; END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'Expected failure: %', expected;
END $$;
DO $$
DECLARE
  owner uuid := '10000000-0000-4000-8000-000000000001';
  parent uuid := '10000000-0000-4000-8000-000000000002';
  outsider uuid := '10000000-0000-4000-8000-000000000003';
  unverified uuid := '10000000-0000-4000-8000-000000000004';
  fid uuid;
  original jsonb;
  loaded jsonb;
  parent_original jsonb;
  invitation jsonb;
  next_invitation jsonb;
  game jsonb;
  i integer;
BEGIN
  SELECT data INTO original FROM public.multiply_profiles WHERE user_id = owner;
  loaded := pg_temp.call_family('load', '{}', owner); fid := (loaded->'family'->>'id')::uuid;
  PERFORM pg_temp.assert_that(loaded->'data' = original, 'migration preserves the exact legacy profile JSON');
  PERFORM pg_temp.assert_that((SELECT count(*) = 1 FROM public.multiply_families WHERE owner_id = owner), 'load does not duplicate migrated family');
  parent_original := pg_temp.call_family('load', '{}', parent);
  PERFORM pg_temp.assert_that(parent_original->'data'->'players'->0->>'name' = 'Ethan', 'new login bootstraps defaults');
  PERFORM pg_temp.expect_error('load', jsonb_build_object('familyId', fid), outsider, 'Family access denied');
  PERFORM pg_temp.expect_error('save_player', jsonb_build_object('familyId', fid, 'player', jsonb_build_object('id', 'steal', 'name', 'No', 'maxTable', 5, 'maxMultiplier', 5)), outsider, 'Family access denied');
  PERFORM pg_temp.expect_error('invite', jsonb_build_object('familyId', fid, 'email', 'bad email'), owner, 'valid email');
  invitation := pg_temp.call_family('invite', jsonb_build_object('familyId', fid, 'email', ' PARENT@example.test '), owner);
  PERFORM pg_temp.assert_that(invitation->>'email' = 'parent@example.test', 'email is normalized');
  PERFORM pg_temp.assert_that(length(invitation->>'token') = 64, 'invite token has two random UUIDs');
  PERFORM pg_temp.assert_that((SELECT token_hash = sha256(convert_to(invitation->>'token', 'UTF8')) FROM public.multiply_family_invitations WHERE id = (invitation->>'id')::uuid), 'only token hash stored');
  PERFORM pg_temp.expect_error('accept_invitation', jsonb_build_object('token', invitation->>'token'), outsider, 'verified invited email');
  loaded := pg_temp.call_family('accept_invitation', jsonb_build_object('token', invitation->>'token'), parent);
  PERFORM pg_temp.assert_that(loaded->'family'->>'id' = fid::text, 'invited parent joins same family');
  PERFORM pg_temp.assert_that(jsonb_array_length(loaded->'families') = 2, 'parent retains original family');
  PERFORM pg_temp.assert_that(pg_temp.call_family('load', jsonb_build_object('familyId', parent_original->'family'->>'id'), parent)->'data' = parent_original->'data', 'joining never merges existing data');
  PERFORM pg_temp.assert_that(loaded->'invitations' = '[]'::jsonb, 'non-owner cannot enumerate invitations');
  PERFORM pg_temp.expect_error('accept_invitation', jsonb_build_object('token', invitation->>'token'), parent, 'unavailable or expired');
  PERFORM pg_temp.expect_error('invite', jsonb_build_object('familyId', fid, 'email', 'outsider@example.test'), parent, 'Only the family owner');
  PERFORM pg_temp.expect_error('remove_member', jsonb_build_object('familyId', fid, 'userId', owner), parent, 'Only the family owner');
  PERFORM pg_temp.expect_error('remove_member', jsonb_build_object('familyId', fid, 'userId', owner), owner, 'owner cannot be removed');
  PERFORM pg_temp.expect_error('save_player', jsonb_build_object('familyId', fid, 'player', jsonb_build_object('id', 'one', 'name', 'One', 'maxTable', 16, 'maxMultiplier', 5)), parent, 'between 1 and 15');
  PERFORM pg_temp.call_family('save_player', jsonb_build_object('familyId', fid, 'player', jsonb_build_object('id', 'one', 'name', 'One', 'maxTable', 5, 'maxMultiplier', 5)), owner);
  loaded := pg_temp.call_family('save_player', jsonb_build_object('familyId', fid, 'player', jsonb_build_object('id', 'two', 'name', 'Two', 'maxTable', 5, 'maxMultiplier', 5)), parent);
  PERFORM pg_temp.assert_that(jsonb_array_length(loaded->'data'->'players') = jsonb_array_length(original->'players') + 2, 'independent stale player writes preserve both changes');
  game := jsonb_build_object('id', 'retry-me', 'playerId', 'one', 'mode', 'practice', 'answerMode', 'choice', 'table', 1, 'maxMultiplier', 5,
    'correct', 999, 'score', 999, 'results', jsonb_build_array(jsonb_build_object('table', 1, 'multiplier', 1, 'correct', true)));
  SELECT result INTO loaded FROM public.multiply_family_action('save_session',
    jsonb_build_object('familyId', fid, 'gameSession', jsonb_set(jsonb_set(game, '{id}', '"invalid-attempt"'::jsonb), '{results,0,correct}', '"not-a-boolean"'::jsonb)),
    json_build_object('x-hasura-role', 'user', 'x-hasura-user-id', owner));
  PERFORM pg_temp.assert_that(loaded->'error'->>'code' = '22023', 'validation errors use production-safe envelope');
  PERFORM pg_temp.assert_that(NOT EXISTS (SELECT 1 FROM public.multiply_family_game_receipts WHERE family_id = fid AND session_id = 'invalid-attempt'), 'failed mutation rolls back its receipt');
  loaded := pg_temp.call_family('save_session', jsonb_build_object('familyId', fid, 'gameSession', game), owner);
  loaded := pg_temp.call_family('save_session', jsonb_build_object('familyId', fid, 'gameSession', game), parent);
  PERFORM pg_temp.assert_that(loaded->'data'->'stats'->'one:1x1'->>'attempts' = '1', 'retry is idempotent across parents');
  PERFORM pg_temp.assert_that(loaded->'data'->'sessions'->-1->>'correct' = '1' AND loaded->'data'->'sessions'->-1->>'score' IS NULL, 'server derives totals and score');
  FOR i IN 1..205 LOOP
    loaded := pg_temp.call_family('save_session', jsonb_build_object('familyId', fid, 'gameSession', jsonb_set(game, '{id}', to_jsonb('window-' || i))), CASE WHEN i % 2 = 0 THEN owner ELSE parent END);
  END LOOP;
  PERFORM pg_temp.assert_that(jsonb_array_length(loaded->'data'->'sessions') = 200, 'history display cap preserved');
  loaded := pg_temp.call_family('save_session', jsonb_build_object('familyId', fid, 'gameSession', game), parent);
  PERFORM pg_temp.assert_that(loaded->'data'->'stats'->'one:1x1'->>'attempts' = '206', 'old receipt remains idempotent after history eviction');
  PERFORM pg_temp.assert_that(jsonb_array_length(loaded->'data'->'stats'->'one:1x1'->'recent') = 10, 'recent answers bounded at ten');
  PERFORM pg_temp.assert_that(loaded->'data'->'customField' = original->'customField', 'subsequent writes preserve unknown profile fields');
  invitation := pg_temp.call_family('invite', jsonb_build_object('familyId', fid, 'email', 'unverified@example.test'), owner);
  PERFORM pg_temp.expect_error('accept_invitation', jsonb_build_object('token', invitation->>'token'), unverified, 'verified invited email');
  invitation := pg_temp.call_family('invite', jsonb_build_object('familyId', fid, 'email', 'outsider@example.test'), owner);
  next_invitation := pg_temp.call_family('invite', jsonb_build_object('familyId', fid, 'email', 'outsider@example.test'), owner);
  PERFORM pg_temp.expect_error('accept_invitation', jsonb_build_object('token', invitation->>'token'), outsider, 'unavailable or expired');
  PERFORM pg_temp.call_family('cancel_invitation', jsonb_build_object('familyId', fid, 'invitationId', next_invitation->>'id'), owner);
  PERFORM pg_temp.expect_error('accept_invitation', jsonb_build_object('token', next_invitation->>'token'), outsider, 'unavailable or expired');
  invitation := pg_temp.call_family('invite', jsonb_build_object('familyId', fid, 'email', 'outsider@example.test'), owner);
  UPDATE public.multiply_family_invitations SET expires_at = now() - interval '1 second' WHERE id = (invitation->>'id')::uuid;
  PERFORM pg_temp.expect_error('accept_invitation', jsonb_build_object('token', invitation->>'token'), outsider, 'unavailable or expired');
  PERFORM pg_temp.call_family('remove_member', jsonb_build_object('familyId', fid, 'userId', parent), owner);
  PERFORM pg_temp.expect_error('load', jsonb_build_object('familyId', fid), parent, 'Family access denied');
  PERFORM pg_temp.expect_error('save_session', jsonb_build_object('familyId', fid, 'gameSession', game), parent, 'Family access denied');
  loaded := pg_temp.call_family('load', jsonb_build_object('familyId', fid), owner);
  PERFORM pg_temp.assert_that(loaded->'data'->'stats'->'one:1x1'->>'attempts' = '206', 'removing parent retains game history');
  PERFORM pg_temp.assert_that((SELECT count(*) = 0 FROM public.multiply_family_action_results), 'RPC results never persisted');
END $$;
ROLLBACK;
