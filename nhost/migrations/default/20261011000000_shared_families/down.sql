-- Rollback is deliberately blocked after shared data exists: splitting a family
-- cannot preserve access and both parents' progress without a recovery plan.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.multiply_family_members m JOIN public.multiply_families f ON f.id = m.family_id WHERE m.user_id <> f.owner_id)
    OR EXISTS (SELECT 1 FROM public.multiply_families f LEFT JOIN public.multiply_profiles p ON p.user_id = f.owner_id WHERE p.user_id IS NULL OR f.data IS DISTINCT FROM p.data) THEN
    RAISE EXCEPTION 'Shared family data has changed; export and reconcile it before rollback';
  END IF;
END $$;
DROP FUNCTION public.multiply_family_action(text, jsonb, json);
DROP FUNCTION public.multiply_family_snapshot(uuid, uuid);
DROP TABLE public.multiply_family_action_results;
DROP TABLE public.multiply_family_game_receipts;
DROP TABLE public.multiply_family_invitations;
DROP TABLE public.multiply_family_members;
DROP TABLE public.multiply_families;
