-- Admin 역할이 모든 매장 social 데이터에 접근할 수 있도록 RLS 보강

CREATE POLICY "social_accounts_admin" ON public.social_accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "social_posts_admin" ON public.social_posts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
