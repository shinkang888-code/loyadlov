CREATE OR REPLACE FUNCTION public.prevent_profile_store_code_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow initial assignment (NULL -> value) during onboarding.
  IF OLD.store_code IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.store_code IS DISTINCT FROM OLD.store_code
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'store_code can only be changed by an administrator';
  END IF;
  RETURN NEW;
END;
$$;