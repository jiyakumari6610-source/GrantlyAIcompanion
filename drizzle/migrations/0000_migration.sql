-- Synchronized Supabase schema & migration
-- Matches supabase/migrations/20261108000000_grantly_init.sql

CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  dob text,
  gender text DEFAULT 'All',
  state text DEFAULT 'Jharkhand',
  city text,
  education_level text DEFAULT 'Undergraduate',
  course text,
  college text,
  academic_year integer DEFAULT 1,
  percentage numeric DEFAULT 75,
  annual_family_income numeric DEFAULT 250000,
  category text DEFAULT 'General',
  disability_status boolean DEFAULT false,
  is_first_gen boolean DEFAULT false,
  financial_background text,
  estimated_annual_cost numeric DEFAULT 150000,
  confirmed_funding numeric DEFAULT 0,
  category_preferences text[] DEFAULT ARRAY['Engineering', 'Merit-cum-Means', 'State Domicile'],
  onboarding_completed boolean DEFAULT false,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own profile select" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Own profile insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Own profile update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Own profile delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.scholarships (
  id text PRIMARY KEY,
  name text NOT NULL,
  provider text NOT NULL,
  provider_type text DEFAULT 'Government',
  description text,
  award_amount numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'INR',
  education_levels text[] DEFAULT ARRAY['Undergraduate'],
  eligible_courses text[] DEFAULT ARRAY['All'],
  eligible_states text[] DEFAULT ARRAY['All India'],
  minimum_marks numeric DEFAULT 0,
  maximum_family_income numeric DEFAULT 0,
  categories text[] DEFAULT ARRAY['All'],
  gender_criteria text DEFAULT 'All',
  required_documents text[] DEFAULT ARRAY[]::text[],
  deadline text,
  days_left integer DEFAULT 30,
  official_source_url text,
  verification_status text DEFAULT 'VERIFIED',
  academic_year text DEFAULT '2025-26',
  tags text[] DEFAULT ARRAY[]::text[],
  disclaimer text,
  trust_rating integer DEFAULT 5,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.scholarships TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.scholarships TO authenticated;
GRANT ALL ON public.scholarships TO service_role;
ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can browse scholarships" ON public.scholarships
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert scholarships" ON public.scholarships
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update scholarships" ON public.scholarships
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete scholarships" ON public.scholarships
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_scholarships_status ON public.scholarships (verification_status);
CREATE INDEX IF NOT EXISTS idx_scholarships_deadline ON public.scholarships (days_left);
CREATE INDEX IF NOT EXISTS idx_scholarships_award ON public.scholarships (award_amount);

CREATE TABLE IF NOT EXISTS public.applications (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  scholarship_id text NOT NULL,
  scholarship_name text,
  status text NOT NULL DEFAULT 'Saved',
  applied_date text,
  deadline text,
  award_amount numeric DEFAULT 0,
  notes text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own applications" ON public.applications
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_applications_user ON public.applications (user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications (status);

CREATE TABLE IF NOT EXISTS public.saved_scholarships (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scholarship_id text NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scholarship_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_scholarships TO authenticated;
GRANT ALL ON public.saved_scholarships TO service_role;
ALTER TABLE public.saved_scholarships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saved scholarships" ON public.saved_scholarships
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.documents (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  storage_path text,
  name text,
  category text,
  file_type text,
  size_bytes bigint,
  analysis_status text DEFAULT 'PENDING',
  readiness_score integer DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own documents" ON public.documents
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.reports (
  id text PRIMARY KEY,
  scholarship_id text NOT NULL,
  reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.reports TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can report suspicious scheme" ON public.reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (reported_by IS NULL OR reported_by = auth.uid());

CREATE POLICY "Admins can view reports" ON public.reports
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage reports" ON public.reports
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users upload own documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users read own documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Authenticated users update own documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users delete own documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);