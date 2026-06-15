
-- 1) Prevent users from changing their own store_code
CREATE OR REPLACE FUNCTION public.prevent_profile_store_code_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.store_code IS DISTINCT FROM OLD.store_code
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'store_code can only be changed by an administrator';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_lock_store_code ON public.profiles;
CREATE TRIGGER profiles_lock_store_code
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_store_code_change();

-- 2) Lock down user_roles writes to admins only
CREATE POLICY "admins_insert_roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins_update_roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins_delete_roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Tighten contact_submissions INSERT validation
DROP POLICY IF EXISTS "anyone_can_submit" ON public.contact_submissions;

CREATE POLICY "anyone_can_submit" ON public.contact_submissions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(btrim(name)) BETWEEN 1 AND 100
    AND length(btrim(phone)) BETWEEN 7 AND 30
    AND (message IS NULL OR length(message) <= 2000)
    AND (store_name IS NULL OR length(store_name) <= 200)
    AND (industry IS NULL OR length(industry) <= 100)
    AND admin_note IS NULL
    AND status = 'new'::lead_status
  );
