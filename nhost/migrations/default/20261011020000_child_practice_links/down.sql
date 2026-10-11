-- Untrack both functions and the practice result table in Hasura first.
DROP FUNCTION public.multiply_practice_action(text, jsonb, json);
DROP FUNCTION public.multiply_player_link_action(text, jsonb, json);
DROP TABLE public.multiply_practice_action_results;
DROP TABLE public.multiply_player_links;
