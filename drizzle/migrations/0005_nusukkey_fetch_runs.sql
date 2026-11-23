CREATE TABLE public.code_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok','failed')),
  added integer NOT NULL DEFAULT 0,
  already_had integer NOT NULL DEFAULT 0,
  confirmed integer NOT NULL DEFAULT 0,
  sample text[] NOT NULL DEFAULT '{}',
  reason text
);

GRANT SELECT ON public.code_import_runs TO authenticated;
GRANT ALL ON public.code_import_runs TO service_role;

ALTER TABLE public.code_import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read import runs"
ON public.code_import_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX code_import_runs_ran_at_idx ON public.code_import_runs (ran_at DESC);

DELETE FROM public.code_sync_state WHERE id = 'nusukkeys';
INSERT INTO public.code_sync_state (id) VALUES ('nusukkey') ON CONFLICT (id) DO NOTHING;