ALTER TABLE public.referral_codes ADD COLUMN IF NOT EXISTS source text;

CREATE TABLE public.code_sync_state (
  id text PRIMARY KEY,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_success_added integer NOT NULL DEFAULT 0,
  last_success_skipped integer NOT NULL DEFAULT 0,
  last_failure_at timestamptz,
  last_failure_reason text,
  consecutive_failures integer NOT NULL DEFAULT 0
);

GRANT SELECT ON public.code_sync_state TO authenticated;
GRANT ALL ON public.code_sync_state TO service_role;

ALTER TABLE public.code_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read sync state"
ON public.code_sync_state
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));