DROP POLICY IF EXISTS "profiles_select_same_store" ON public.profiles;

CREATE POLICY "profiles_select_same_store" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    store_code IS NOT NULL
    AND store_code = public.current_store_code()
  );