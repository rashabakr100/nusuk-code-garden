ALTER TABLE public.referral_codes
  ADD CONSTRAINT referral_codes_ng_prefix CHECK (code ~ '^NG-\S+$');

CREATE TABLE public.code_owner_tokens (
  code_id uuid PRIMARY KEY REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  token text NOT NULL
);

GRANT ALL ON public.code_owner_tokens TO service_role;

ALTER TABLE public.code_owner_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.add_code(_code text, _token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF char_length(trim(_code)) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'invalid code' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.referral_codes (code, user_id)
  VALUES (trim(_code), auth.uid())
  RETURNING id INTO _id;

  IF _token IS NOT NULL AND char_length(_token) BETWEEN 20 AND 200 THEN
    INSERT INTO public.code_owner_tokens (code_id, token) VALUES (_id, _token);
  END IF;

  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_code_with_token(_id uuid, _token text, _code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF char_length(trim(_code)) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'invalid code' USING ERRCODE = '23514';
  END IF;

  UPDATE public.referral_codes r
  SET code = trim(_code)
  WHERE r.id = _id
    AND _token IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.code_owner_tokens t
      WHERE t.code_id = _id AND t.token = _token
    );
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_code_with_token(_id uuid, _token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.referral_codes r
  WHERE r.id = _id
    AND _token IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.code_owner_tokens t
      WHERE t.code_id = _id AND t.token = _token
    );
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.add_code(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_code_with_token(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_code_with_token(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_code(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_code_with_token(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_code_with_token(uuid, text) TO anon, authenticated;