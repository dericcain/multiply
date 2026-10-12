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
DO $$
DECLARE
  actor uuid := '10000000-0000-4000-8000-000000000001';
  loaded jsonb; game jsonb; fid uuid; streak jsonb;
BEGIN
  loaded := pg_temp.call_family('load', '{}', actor);
  fid := (loaded->'family'->>'id')::uuid;
  loaded := pg_temp.call_family('save_player', jsonb_build_object('familyId', fid, 'player',
    jsonb_build_object('id','streak-player','name','Streak learner','maxTable',10,'maxMultiplier',10)), actor);
  game := jsonb_build_object('id','five-varied','playerId','streak-player','mode','practice','answerMode','type','table',3,'maxMultiplier',5,
    'results',(SELECT jsonb_agg(jsonb_build_object('table',3,'multiplier',i,'correct',true)) FROM generate_series(1,5) i));
  loaded := pg_temp.call_family('save_session', jsonb_build_object('familyId',fid,'gameSession',game), actor);
  streak := loaded->'data'->'streaks'->'streak-player';
  PERFORM pg_temp.assert_that(streak->>'current' = '5' AND streak->>'best' = '5', 'five different facts earn saved streak');
  PERFORM pg_temp.assert_that(loaded->'award'->>'totalXp' = '5', 'streaks do not add farming XP bonuses');
  loaded := pg_temp.call_family('save_session', jsonb_build_object('familyId',fid,'gameSession',jsonb_set(game,'{id}','"repeat-five"')), actor);
  PERFORM pg_temp.assert_that(loaded->'data'->'streaks'->'streak-player' = streak, 'repeating five facts preserves but cannot grow streak');
  game := jsonb_set(jsonb_set(game,'{id}','"break-run"'),'{results}', '[{"table":3,"multiplier":4,"correct":false},{"table":3,"multiplier":5,"correct":true}]');
  loaded := pg_temp.call_family('save_session',jsonb_build_object('familyId',fid,'gameSession',game),actor);
  PERFORM pg_temp.assert_that(loaded->'data'->'streaks'->'streak-player'->>'current' = '1' AND loaded->'data'->'streaks'->'streak-player'->>'best' = '5', 'mistake resets only current run');
  game := jsonb_build_object('id','reverse-fact','playerId','streak-player','mode','challenge','answerMode','choice','table',5,'maxMultiplier',4,
    'results','[{"table":5,"multiplier":3,"correct":true},{"table":5,"multiplier":4,"correct":true}]'::jsonb);
  loaded := pg_temp.call_family('save_session',jsonb_build_object('familyId',fid,'gameSession',game),actor);
  streak := loaded->'data'->'streaks'->'streak-player';
  PERFORM pg_temp.assert_that(streak->>'current' = '2' AND streak->>'best' = '5', 'reversed fact is a repeat while new fact grows streak');
  loaded := pg_temp.call_family('save_session',jsonb_build_object('familyId',fid,'gameSession',jsonb_set(game,'{id}','"five-varied"')),actor);
  PERFORM pg_temp.assert_that(loaded->'data'->'streaks'->'streak-player' = streak, 'late receipt retry cannot restore or replay old streak');
  loaded := pg_temp.call_family('save_player',jsonb_build_object('familyId',fid,'player',jsonb_build_object('id','streak-player','name','Renamed','maxTable',5,'maxMultiplier',5)),actor);
  PERFORM pg_temp.assert_that(loaded->'data'->'streaks'->'streak-player' = streak, 'settings preserve earned streaks');
  PERFORM pg_temp.assert_that((SELECT count(*) FROM public.multiply_player_streaks WHERE family_id=fid AND player_id='streak-player') = 1, 'one ledger row per player');
END;
$$;

ROLLBACK;
