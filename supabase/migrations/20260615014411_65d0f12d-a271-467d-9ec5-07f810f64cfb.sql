
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'converted', 'dropped');

CREATE TABLE public.contact_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text NOT NULL,
  store_name text,
  industry text,
  message text,
  status public.lead_status NOT NULL DEFAULT 'new',
  admin_note text,
  source text DEFAULT 'landing',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT name_len CHECK (char_length(name) BETWEEN 1 AND 80),
  CONSTRAINT phone_len CHECK (char_length(phone) BETWEEN 6 AND 30),
  CONSTRAINT message_len CHECK (message IS NULL OR char_length(message) <= 2000)
);

GRANT INSERT ON public.contact_submissions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.contact_submissions TO authenticated;
GRANT ALL ON public.contact_submissions TO service_role;

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_submit"
  ON public.contact_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "owners_read_own"
  ON public.contact_submissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admins_read_all"
  ON public.contact_submissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins_update_all"
  ON public.contact_submissions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER contact_submissions_set_updated_at
  BEFORE UPDATE ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX contact_submissions_status_idx ON public.contact_submissions (status, created_at DESC);
