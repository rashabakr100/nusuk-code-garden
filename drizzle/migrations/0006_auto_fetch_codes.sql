ALTER TABLE public.code_sync_state
  ADD COLUMN IF NOT EXISTS auto_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lock_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_manual_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_auto_at timestamptz;

ALTER TABLE public.code_import_runs
  ADD COLUMN IF NOT EXISTS trigger text NOT NULL DEFAULT 'manual';

-- Claims the single run lock. Manual taps also need 15s since the last tap; automatic runs need
-- auto fetch on, and after 5 failures in a row wait 6 hours since the last automatic try.
CREATE OR REPLACE FUNCTION public.claim_code_fetch(_trigger text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE s public.code_sync_state%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.code_sync_state WHERE id = 'nusukkey' FOR UPDATE;
  IF NOT FOUND THEN RETURN 'missing'; END IF;
  IF _trigger = 'auto' THEN
    IF NOT s.auto_enabled THEN RETURN 'disabled'; END IF;
    IF s.consecutive_failures >= 5 AND s.last_auto_at IS NOT NULL AND s.last_auto_at > now() - interval '6 hours' - interval '2 minutes' THEN
      RETURN 'backoff';
    END IF;
  ELSE
    IF s.last_manual_at IS NOT NULL AND s.last_manual_at > now() - interval '15 seconds' THEN RETURN 'too_soon'; END IF;
  END IF;
  IF s.lock_until IS NOT NULL AND s.lock_until > now() THEN RETURN 'busy'; END IF;
  UPDATE public.code_sync_state SET
    lock_until = now() + interval '2 minutes',
    last_attempt_at = now(),
    last_manual_at = CASE WHEN _trigger = 'auto' THEN last_manual_at ELSE now() END,
    last_auto_at = CASE WHEN _trigger = 'auto' THEN now() ELSE last_auto_at END
  WHERE id = 'nusukkey';
  RETURN 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_code_fetch(_ok boolean, _added integer, _skipped integer, _reason text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.code_sync_state SET
    lock_until = NULL,
    consecutive_failures = CASE WHEN _ok THEN 0 ELSE consecutive_failures + 1 END,
    last_success_at = CASE WHEN _ok THEN now() ELSE last_success_at END,
    last_success_added = CASE WHEN _ok THEN _added ELSE last_success_added END,
    last_success_skipped = CASE WHEN _ok THEN _skipped ELSE last_success_skipped END,
    last_failure_at = CASE WHEN _ok THEN last_failure_at ELSE now() END,
    last_failure_reason = CASE WHEN _ok THEN last_failure_reason ELSE left(_reason, 300) END
  WHERE id = 'nusukkey';
$$;

REVOKE ALL ON FUNCTION public.claim_code_fetch(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_code_fetch(boolean, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_code_fetch(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_code_fetch(boolean, integer, integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.set_auto_fetch(_on boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.code_sync_state SET auto_enabled = _on WHERE id = 'nusukkey';
  RETURN _on;
END;
$$;

REVOKE ALL ON FUNCTION public.set_auto_fetch(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_auto_fetch(boolean) TO authenticated;