BEGIN;
CREATE FUNCTION pg_temp.assert_bonus(ok boolean, detail text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', detail; END IF; END $$;
DO $$
DECLARE
  actor uuid := '10000000-0000-4000-8000-000000000001';
  fid uuid; loaded jsonb; game jsonb; saved_award jsonb; saved_balance bigint; variant text; link_token text;
BEGIN
  SELECT result INTO loaded FROM public.multiply_family_action('load', '{}', json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
  fid := (loaded->'family'->>'id')::uuid;
  SELECT result INTO loaded FROM public.multiply_family_action('save_player', jsonb_build_object('familyId',fid,'player',
    jsonb_build_object('id','typer','name','Typer','maxTable',5,'maxMultiplier',5)), json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
  game := jsonb_build_object('id','bonus-full','playerId','typer','mode','challenge','answerMode','type','table',1,'maxMultiplier',5,
    'challengeXp',999,'totalXp',999,
    'results',(SELECT jsonb_agg(jsonb_build_object('table',1,'multiplier',i,'correct',i <= 4)) FROM generate_series(1,5) i));
  SELECT result INTO loaded FROM public.multiply_family_action('save_session',jsonb_build_object('familyId',fid,'gameSession',game),json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
  PERFORM pg_temp.assert_bonus(loaded->'award'->>'challengeXp'='5' AND loaded->'award'->>'totalXp'='9', '80 percent full typed challenge earns four answer XP plus five completion XP');
  saved_award := loaded->'award'; saved_balance := (loaded->'data'->'xp'->>'typer')::bigint;
  SELECT result INTO loaded FROM public.multiply_family_action('save_session',jsonb_build_object('familyId',fid,'gameSession',game),json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
  PERFORM pg_temp.assert_bonus(loaded->'award'=saved_award AND (loaded->'data'->'xp'->>'typer')::bigint=saved_balance, 'retry returns original award and balance');
  FOR variant IN SELECT unnest(ARRAY['choice','practice','partial','inaccurate']) LOOP
    game := jsonb_set(game,'{id}',to_jsonb('bonus-'||variant));
    game := jsonb_set(game,'{mode}','"challenge"'); game := jsonb_set(game,'{answerMode}','"type"');
    game := jsonb_set(game,'{results}',(SELECT jsonb_agg(jsonb_build_object('table',1,'multiplier',i,'correct',i <= 4)) FROM generate_series(1,5) i));
    IF variant='choice' THEN game := jsonb_set(game,'{answerMode}','"choice"'); END IF;
    IF variant='practice' THEN game := jsonb_set(game,'{mode}','"practice"'); END IF;
    IF variant='partial' THEN game := jsonb_set(game,'{results}',(game->'results') - 4); END IF;
    IF variant='inaccurate' THEN game := jsonb_set(game,'{results,0,correct}','false'); END IF;
    SELECT result INTO loaded FROM public.multiply_family_action('save_session',jsonb_build_object('familyId',fid,'gameSession',game),
      json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
    PERFORM pg_temp.assert_bonus(loaded->'award'->>'challengeXp'='0',variant||' never earns typed bonus');
  END LOOP;
  -- Duplicate facts cannot masquerade as a completed challenge.
  game := jsonb_set(game,'{id}','"bonus-invalid"');
  game := jsonb_set(game,'{results}',(SELECT jsonb_agg(jsonb_build_object('table',1,'multiplier',1,'correct',true)) FROM generate_series(1,5)));
  SELECT result INTO loaded FROM public.multiply_family_action('save_session',jsonb_build_object('familyId',fid,'gameSession',game),json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
  PERFORM pg_temp.assert_bonus(loaded->'error'->>'code'='22023' AND NOT EXISTS(SELECT 1 FROM public.multiply_family_game_receipts WHERE family_id=fid AND session_id='bonus-invalid'), 'invalid full challenge rolls back XP and receipt');
  SELECT result INTO loaded FROM public.multiply_player_link_action('create',jsonb_build_object('familyId',fid,'playerId','typer'),json_build_object('x-hasura-role','user','x-hasura-user-id',actor));
  link_token := loaded->'link'->>'token';
  game := jsonb_set(game,'{id}','"child-bonus"');
  game := jsonb_set(game,'{results}',(SELECT jsonb_agg(jsonb_build_object('table',1,'multiplier',i,'correct',true)) FROM generate_series(1,5) i));
  SELECT result INTO loaded FROM public.multiply_practice_action('save_session',jsonb_build_object('token',link_token,'gameSession',game),json_build_object('x-hasura-role','public'));
  PERFORM pg_temp.assert_bonus(loaded->'award'->>'challengeXp'='5', 'child link shares the same completion bonus');
  saved_award := loaded->'award'; saved_balance := (loaded->'data'->'xp'->>'typer')::bigint;
  SELECT result INTO loaded FROM public.multiply_practice_action('save_session',jsonb_build_object('token',link_token,'gameSession',game),json_build_object('x-hasura-role','public'));
  PERFORM pg_temp.assert_bonus(loaded->'award'=saved_award AND (loaded->'data'->'xp'->>'typer')::bigint=saved_balance, 'child retry never duplicates bonus');
  game := jsonb_set(game,'{id}','"child-off"');
  SELECT result INTO loaded FROM public.multiply_practice_action('save_session',jsonb_build_object('token',link_token,'gameSession',game),json_build_object('x-hasura-role','public'));
  PERFORM pg_temp.assert_bonus(loaded->'award'->>'challengeXp'='5', 'another qualifying child challenge earns its completion bonus');
END;
$$;
ROLLBACK;
