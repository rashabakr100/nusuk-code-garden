CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

ALTER TABLE public.referral_codes ADD COLUMN user_id uuid DEFAULT auth.uid();
CREATE INDEX referral_codes_user_id_idx ON public.referral_codes (user_id);

GRANT SELECT, INSERT ON public.referral_codes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_codes TO authenticated;
GRANT ALL ON public.referral_codes TO service_role;

DROP POLICY IF EXISTS "Anyone can add codes" ON public.referral_codes;

CREATE POLICY "Visitors can add unowned codes"
ON public.referral_codes FOR INSERT TO anon
WITH CHECK (
  user_id IS NULL
  AND char_length(trim(code)) BETWEEN 1 AND 64
);

CREATE POLICY "Signed-in users add their own codes"
ON public.referral_codes FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND char_length(trim(code)) BETWEEN 1 AND 64
);

CREATE POLICY "Owners and admins can edit codes"
ON public.referral_codes FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (
  (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  AND char_length(trim(code)) BETWEEN 1 AND 64
);

CREATE POLICY "Owners and admins can delete codes"
ON public.referral_codes FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));