CREATE TABLE IF NOT EXISTS public.multiply_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_multiply_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS multiply_profiles_updated_at ON public.multiply_profiles;
CREATE TRIGGER multiply_profiles_updated_at
BEFORE UPDATE ON public.multiply_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_multiply_profiles_updated_at();
