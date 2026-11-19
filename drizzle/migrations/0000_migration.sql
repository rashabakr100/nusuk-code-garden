CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (char_length(code) BETWEEN 1 AND 64),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.referral_codes TO anon, authenticated;
GRANT ALL ON public.referral_codes TO service_role;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view codes" ON public.referral_codes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can add codes" ON public.referral_codes FOR INSERT TO anon, authenticated WITH CHECK (char_length(trim(code)) BETWEEN 1 AND 64);
ALTER PUBLICATION supabase_realtime ADD TABLE public.referral_codes;