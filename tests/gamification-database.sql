-- Runs after the migration; family assertions above rollback their mutations.
BEGIN;
CREATE FUNCTION pg_temp.assert_xp(ok boolean, detail text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', detail; END IF; END $$;
DO $$
DECLARE
  actor uuid := '10000000-0000-4000-8000-000000000001';
  new_user uuid := '10000000-0000-4000-8000-000000000005';
  fid uuid;
  loaded jsonb;
  game jsonb;
  first_award jsonb;
  stats_before jsonb;
  invalid_game jsonb;
  i integer;
BEGIN
  INSERT INTO auth.users(id,email) VALUES (new_user,'new-user@example.test');
  SELECT result INTO loaded FROM public.multiply_family_action('load','{}',json_build_object('x-hasura-role','user','x-hasura-user-id',new_user));
  PERFORM pg_temp.assert_xp(jsonb_array_length(loaded->'data'->'players')=1 AND loaded->'data'->'players'->0->>'name'='Student', 'new families start with one editable student');

  SELECT id INTO fid FROM public.multiply_families WHERE owner_id = actor;
  -- Legacy correct-answer totals preserve the displayed opening XP, including
  -- facts outside the assigned range; preexisting history remains untouched.
  SELECT result INTO loaded FROM public.multiply_family_action('load', '{}', json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
  PERFORM pg_temp.assert_xp(loaded->'data'->'xp'->>'legacy' = '11', 'opening balance seeded from displayed XP');
  PERFORM pg_temp.assert_xp(loaded->'data'->'sessions'->0->>'score' = '123', 'old challenge history preserved');
  -- Add currently mastered legacy fact then explicitly initialize a fresh player.
  UPDATE public.multiply_families SET data = jsonb_set(jsonb_set(data, '{players}', data->'players' || '[{"id":"master","name":"Master","maxTable":5,"maxMultiplier":5}]'),
    '{stats,master:1x1}', '{"correct":5,"attempts":5,"recent":[true,true,true,true,true]}') WHERE id = fid;
  SELECT result INTO loaded FROM public.multiply_family_action('load', jsonb_build_object('familyId',fid), json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
  PERFORM pg_temp.assert_xp(loaded->'data'->'xp'->>'master' = '30', 'opening includes current mastery bonus');
  PERFORM pg_temp.assert_xp(loaded->'data'->'awardedFacts'->'master' = '["1x1"]'::jsonb, 'current mastery marked already rewarded');
  game := '{"id":"eight-plus-mastery","playerId":"legacy","mode":"practice","answerMode":"choice","table":1,"maxMultiplier":5,"results":[]}'::jsonb;
  FOR i IN 1..8 LOOP
    game := jsonb_set(game, '{results}', game->'results' || jsonb_build_array(jsonb_build_object('table',1,'multiplier',CASE WHEN i<=5 THEN 1 ELSE 2 END,'correct',true)));
  END LOOP;
  SELECT result INTO loaded FROM public.multiply_family_action('save_session', jsonb_build_object('familyId',fid,'gameSession',game), json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
  first_award := loaded->'award';
  PERFORM pg_temp.assert_xp(first_award->>'answerXp'='8' AND first_award->>'masteryXp'='25' AND first_award->>'totalXp'='33', 'eight answers and one first mastery earn exactly 33');
  PERFORM pg_temp.assert_xp(loaded->'data'->'xp'->>'legacy'='44', 'authoritative balance includes opening');
  stats_before := loaded->'data'->'stats';
  SELECT result INTO loaded FROM public.multiply_family_action('save_session', jsonb_build_object('familyId',fid,'gameSession',game), json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
  PERFORM pg_temp.assert_xp(loaded->'award'=first_award AND loaded->'data'->'stats'=stats_before, 'retry returns original award without stats or XP duplication');
  game := jsonb_set(game, '{results}', '[{"table":1,"multiplier":1,"correct":false}]');
  FOR i IN 1..10 LOOP
    game := jsonb_set(game, '{id}', to_jsonb('lose-'||i));
    PERFORM result FROM public.multiply_family_action('save_session', jsonb_build_object('familyId',fid,'gameSession',game), json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
  END LOOP;
  SELECT result INTO loaded FROM public.multiply_family_action('load',jsonb_build_object('familyId',fid),json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
  PERFORM pg_temp.assert_xp(loaded->'data'->'xp'->>'legacy'='44', 'mastery loss never deducts XP');
  game := jsonb_set(game, '{results}', '[{"table":1,"multiplier":1,"correct":true}]');
  FOR i IN 1..10 LOOP
    game := jsonb_set(game, '{id}', to_jsonb('recover-'||i));
    SELECT result INTO loaded FROM public.multiply_family_action('save_session', jsonb_build_object('familyId',fid,'gameSession',game), json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
    PERFORM pg_temp.assert_xp(loaded->'award'->>'masteryXp'='0', 'recovery never repays first mastery');
  END LOOP;
  PERFORM pg_temp.assert_xp(loaded->'data'->'xp'->>'legacy'='54', 'recovery earns only answer XP');
  SELECT result INTO loaded FROM public.multiply_family_action('save_player',jsonb_build_object('familyId',fid,'player',jsonb_build_object('id','legacy','name','Legacy child','maxTable',1,'maxMultiplier',1)),json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
  PERFORM pg_temp.assert_xp(loaded->'data'->'xp'->>'legacy'='54' AND loaded->'data'->'stats'->'legacy:1x2'->>'correct'='3', 'scope change preserves XP and outside-scope evidence');
  invalid_game := jsonb_set(jsonb_set(game,'{id}','"invalid-xp"'),'{results}', '[{"table":1,"multiplier":2,"correct":true},{"table":16,"multiplier":1,"correct":true}]');
  SELECT result INTO loaded FROM public.multiply_family_action('save_session',jsonb_build_object('familyId',fid,'gameSession',invalid_game),json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
  PERFORM pg_temp.assert_xp(loaded->'error'->>'code'='22023' AND NOT EXISTS (SELECT 1 FROM public.multiply_family_game_receipts WHERE family_id=fid AND session_id='invalid-xp'), 'invalid save rolls back all award and receipt writes');
  -- Evict the first game without earning XP; its receipt must remain durable.
  game := jsonb_set(game,'{results}','[{"table":1,"multiplier":1,"correct":false}]');
  FOR i IN 1..201 LOOP
    game := jsonb_set(game,'{id}',to_jsonb('evict-'||i));
    PERFORM result FROM public.multiply_family_action('save_session',jsonb_build_object('familyId',fid,'gameSession',game),json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
  END LOOP;
  SELECT result INTO loaded FROM public.multiply_family_action('save_session',jsonb_build_object('familyId',fid,'gameSession',jsonb_set(game,'{id}','"eight-plus-mastery"')),json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
  PERFORM pg_temp.assert_xp(loaded->'award'=first_award AND loaded->'data'->'xp'->>'legacy'='54', 'evicted retry returns historical award with latest balance');
  -- Old session IDs receive no invented reward when replayed.
  SELECT result INTO loaded FROM public.multiply_family_action('save_session', jsonb_build_object('familyId',fid,'gameSession',jsonb_set(game,'{id}','"legacy-game"')), json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
  PERFORM pg_temp.assert_xp(loaded->'award'->>'legacy'='true' AND loaded->'data'->'xp'->>'legacy'='54', 'legacy receipt cannot earn again');
END $$;
ROLLBACK;
