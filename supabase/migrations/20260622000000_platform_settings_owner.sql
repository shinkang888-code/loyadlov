-- owner도 플랫폼 설정(app_settings) 관리 가능
-- subscriptions 테이블 (Stripe Phase 7)

CREATE POLICY "app_settings_owner_read" ON public.app_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "app_settings_owner_write" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'standard' CHECK (plan IN ('standard', 'premium')),
  stripe_customer_id text,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('inactive', 'pending', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_store ON public.subscriptions (store_code);

GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated, service_role;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_store_read" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    store_code = public.current_store_code()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "subscriptions_store_write" ON public.subscriptions
  FOR ALL TO authenticated
  USING (
    store_code = public.current_store_code()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    store_code = public.current_store_code()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
