CREATE TABLE public.code_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('copy', 'open')),
  user_id uuid,
  visitor_id text CHECK (visitor_id IS NULL OR char_length(visitor_id) <= 64),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX code_usage_code_id_idx ON public.code_usage (code_id);
GRANT SELECT ON public.code_usage TO authenticated;
GRANT ALL ON public.code_usage TO service_role;
ALTER TABLE public.code_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view code usage" ON public.code_usage
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.user_used_codes (
  user_id uuid NOT NULL,
  code_id uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, code_id)
);
GRANT SELECT, INSERT ON public.user_used_codes TO authenticated;
GRANT ALL ON public.user_used_codes TO service_role;
ALTER TABLE public.user_used_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own used codes" ON public.user_used_codes
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users add their own used codes" ON public.user_used_codes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.record_code_use(_code_id uuid, _action text, _visitor text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _action NOT IN ('copy', 'open') THEN
    RAISE EXCEPTION 'invalid action';
  END IF;
  INSERT INTO public.code_usage (code_id, action, user_id, visitor_id)
  VALUES (_code_id, _action, auth.uid(), left(_visitor, 64));
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.user_used_codes (user_id, code_id)
    VALUES (auth.uid(), _code_id)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.record_code_use(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_code_use(uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_used_codes(_code_ids uuid[])
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.user_used_codes (user_id, code_id)
  SELECT auth.uid(), r.id FROM public.referral_codes r WHERE r.id = ANY(_code_ids)
  ON CONFLICT DO NOTHING;
  RETURN QUERY SELECT u.code_id FROM public.user_used_codes u WHERE u.user_id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.sync_used_codes(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_used_codes(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.code_usage_summary()
RETURNS TABLE (code_id uuid, code text, copies bigint, opens bigint, people bigint, last_used_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT r.id, r.code,
    count(u.id) FILTER (WHERE u.action = 'copy'),
    count(u.id) FILTER (WHERE u.action = 'open'),
    count(DISTINCT coalesce(u.user_id::text, u.visitor_id)),
    max(u.created_at)
  FROM public.referral_codes r
  LEFT JOIN public.code_usage u ON u.code_id = r.id
  GROUP BY r.id, r.code;
END;
$$;
REVOKE ALL ON FUNCTION public.code_usage_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.code_usage_summary() TO authenticated;