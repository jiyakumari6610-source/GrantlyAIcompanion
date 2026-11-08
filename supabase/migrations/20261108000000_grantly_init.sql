-- Grantly AI PostgreSQL Schema & Row Level Security Migration
-- Supabase-native relational schema with RLS and Seed Data

-- 1. App Roles Enum & User Roles Table
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

-- Helper function to check role in RLS without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 2. Student Profiles Table
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

-- 3. Scholarships Catalog Table
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

-- Indexes for scholarship search & filtering
CREATE INDEX IF NOT EXISTS idx_scholarships_status ON public.scholarships (verification_status);
CREATE INDEX IF NOT EXISTS idx_scholarships_deadline ON public.scholarships (days_left);
CREATE INDEX IF NOT EXISTS idx_scholarships_award ON public.scholarships (award_amount);

-- 4. Applications Tracker Table
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

-- 5. Saved/Bookmarked Scholarships Table
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

-- 6. Document Vault Table
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

-- 7. Suspicious Scheme Reports Table
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

-- 8. Storage Bucket Setup & Policies
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

-- 9. Automatic Profile Creation on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    state,
    education_level,
    onboarding_completed,
    data
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    'Jharkhand',
    'Undergraduate',
    false,
    jsonb_build_object(
      'id', NEW.id,
      'fullName', COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
      'email', NEW.email,
      'state', 'Jharkhand',
      'educationLevel', 'Undergraduate',
      'onboardingCompleted', false
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. Seed Official Verified Scholarships
INSERT INTO public.scholarships (
  id, name, provider, provider_type, description, award_amount, currency,
  education_levels, eligible_courses, eligible_states, minimum_marks,
  maximum_family_income, categories, gender_criteria, required_documents,
  deadline, days_left, official_source_url, verification_status, academic_year,
  tags, disclaimer, trust_rating, data
) VALUES
(
  'nsp-post-matric-sc',
  'Centrally Sponsored Post Matric Scholarship for SC Students',
  'Department of Social Justice & Empowerment, Government of India',
  'Government',
  'Statutory scheme providing complete financial assistance for Scheduled Caste students pursuing post-matriculation or post-secondary courses across recognized higher educational institutions.',
  65000,
  'INR',
  ARRAY['Class 12 / Higher Secondary', 'Undergraduate', 'Postgraduate', 'Diploma / Polytechnic', 'Doctoral / PhD'],
  ARRAY['All', 'Engineering', 'Medicine', 'Commerce', 'Sciences', 'Arts'],
  ARRAY['All India'],
  0,
  250000,
  ARRAY['SC'],
  'All',
  ARRAY['Aadhaar Card', 'Caste Certificate issued by Competent Authority', 'Current Financial Year Income Certificate (under ₹2.5L)', 'Previous Examination Marksheet', 'College Bonafide Student Certificate', 'Bank Passbook linked to Aadhaar (DBT active)'],
  '2026-12-31',
  54,
  'https://scholarships.gov.in/',
  'VERIFIED',
  '2025-26',
  ARRAY['Government', 'NSP', 'SC', 'Pan-India', 'Post-Matric'],
  'Official Central Government statutory scheme. Disbursement executed through Aadhaar-based Direct Benefit Transfer (DBT).',
  5,
  '{"id":"nsp-post-matric-sc","name":"Centrally Sponsored Post Matric Scholarship for SC Students","provider":"Department of Social Justice & Empowerment, Government of India","providerType":"Government","description":"Statutory scheme providing complete financial assistance for Scheduled Caste students pursuing post-matriculation or post-secondary courses across recognized higher educational institutions.","educationLevels":["Class 12 / Higher Secondary","Undergraduate","Postgraduate","Diploma / Polytechnic","Doctoral / PhD"],"eligibleCourses":["All","Engineering","Medicine","Commerce","Sciences","Arts"],"eligibleStates":["All India"],"minMarks":0,"maxIncome":250000,"minimumMarks":0,"maximumFamilyIncome":250000,"categories":["SC"],"genderCriteria":"All","awardAmount":65000,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["Aadhaar Card","Caste Certificate issued by Competent Authority","Current Financial Year Income Certificate (under ₹2.5L)","Previous Examination Marksheet","College Bonafide Student Certificate","Bank Passbook linked to Aadhaar (DBT active)"],"deadline":"2026-12-31","daysLeft":54,"officialSourceUrl":"https://scholarships.gov.in/","verificationStatus":"VERIFIED","academicYear":"2025-26","lastCheckedAt":"2026-11-06","applicationSteps":["Register on the National Scholarship Portal (scholarships.gov.in) with Aadhaar verification.","Select Department of Social Justice & Empowerment scheme list.","Enter Institutional AISHE/U-DISE code and upload verified Caste & Income certificates.","Institute Nodal Officer (INO) and District Nodal Officer (DNO) complete biometric verification."],"disclaimer":"Official Central Government statutory scheme. Disbursement executed through Aadhaar-based Direct Benefit Transfer (DBT).","tags":["Government","NSP","SC","Pan-India","Post-Matric"],"trustRating":5,"isSuspiciousWarning":false,"educationLevel":["Class 12 / Higher Secondary","Undergraduate","Postgraduate","Diploma / Polytechnic","Doctoral / PhD"]}'::jsonb
),
(
  'nsp-post-matric-minorities',
  'Post Matric Scholarships Scheme for Minorities',
  'Ministry of Minority Affairs, Government of India',
  'Government',
  'Financial support to meritorious students belonging to notified minority communities (Muslim, Christian, Sikh, Buddhist, Jain, Parsi) for higher secondary, undergraduate, and postgraduate studies.',
  30000,
  'INR',
  ARRAY['Class 12 / Higher Secondary', 'Undergraduate', 'Postgraduate', 'Diploma / Polytechnic', 'Doctoral / PhD'],
  ARRAY['All', 'Engineering', 'Sciences', 'Commerce', 'Humanities', 'Medicine'],
  ARRAY['All India'],
  50,
  200000,
  ARRAY['All'],
  'All',
  ARRAY['Aadhaar / National Identification Proof', 'Self-Declaration of Minority Community Certificate', 'Latest Year Marksheet with minimum 50% marks', 'Income Certificate issued by Tehsildar / SDO', 'Institution Fee Receipt & Bonafide Certificate'],
  '2026-12-15',
  38,
  'https://scholarships.gov.in/',
  'VERIFIED',
  '2025-26',
  ARRAY['Government', 'NSP', 'Minority Affairs', 'Pan-India'],
  'Official Ministry of Minority Affairs scheme. 30% quota earmarked for female students.',
  5,
  '{"id":"nsp-post-matric-minorities","name":"Post Matric Scholarships Scheme for Minorities","provider":"Ministry of Minority Affairs, Government of India","providerType":"Government","description":"Financial support to meritorious students belonging to notified minority communities (Muslim, Christian, Sikh, Buddhist, Jain, Parsi) for higher secondary, undergraduate, and postgraduate studies.","educationLevels":["Class 12 / Higher Secondary","Undergraduate","Postgraduate","Diploma / Polytechnic","Doctoral / PhD"],"eligibleCourses":["All","Engineering","Sciences","Commerce","Humanities","Medicine"],"eligibleStates":["All India"],"minMarks":50,"maxIncome":200000,"minimumMarks":50,"maximumFamilyIncome":200000,"categories":["All"],"genderCriteria":"All","awardAmount":30000,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["Aadhaar / National Identification Proof","Self-Declaration of Minority Community Certificate","Latest Year Marksheet with minimum 50% marks","Income Certificate issued by Tehsildar / SDO","Institution Fee Receipt & Bonafide Certificate"],"deadline":"2026-12-15","daysLeft":38,"officialSourceUrl":"https://scholarships.gov.in/","verificationStatus":"VERIFIED","academicYear":"2025-26","lastCheckedAt":"2026-11-06","applicationSteps":["Authenticate with One-Time Registration (OTR) on scholarships.gov.in.","Fill Academic & Family Income details.","Upload minority self-declaration and fee structure.","Submit for institutional scrutiny."],"disclaimer":"Official Ministry of Minority Affairs scheme. 30% quota earmarked for female students.","tags":["Government","NSP","Minority Affairs","Pan-India"],"trustRating":5,"isSuspiciousWarning":false,"educationLevel":["Class 12 / Higher Secondary","Undergraduate","Postgraduate","Diploma / Polytechnic","Doctoral / PhD"]}'::jsonb
),
(
  'nsp-nmmss-merit-means',
  'National Means-cum-Merit Scholarship Scheme (NMMSS)',
  'Department of School Education & Literacy, Ministry of Education',
  'Government',
  'Central sector scholarship award designed to prevent school dropouts among meritorious students from economically weaker sections continuing into higher secondary education.',
  12000,
  'INR',
  ARRAY['Class 12 / Higher Secondary'],
  ARRAY['Sciences', 'Commerce', 'Arts', 'All'],
  ARRAY['All India'],
  55,
  350000,
  ARRAY['General', 'OBC', 'SC', 'ST', 'EWS'],
  'All',
  ARRAY['NMMSS State Selection Examination Score Card', 'Class 8/9/10/11 Promotion Marksheet (min 55% aggregate)', 'Parental Income Certificate (under ₹3,50,000)', 'Aadhaar Seeded Bank Account Details'],
  '2026-11-30',
  23,
  'https://scholarships.gov.in/',
  'VERIFIED',
  '2025-26',
  ARRAY['Government', 'Ministry of Education', 'Merit-cum-Means', 'NSP'],
  'Administered under Department of School Education guidelines via National Scholarship Portal.',
  5,
  '{"id":"nsp-nmmss-merit-means","name":"National Means-cum-Merit Scholarship Scheme (NMMSS)","provider":"Department of School Education & Literacy, Ministry of Education","providerType":"Government","description":"Central sector scholarship award designed to prevent school dropouts among meritorious students from economically weaker sections continuing into higher secondary education.","educationLevels":["Class 12 / Higher Secondary"],"eligibleCourses":["Sciences","Commerce","Arts","All"],"eligibleStates":["All India"],"minMarks":55,"maxIncome":350000,"minimumMarks":55,"maximumFamilyIncome":350000,"categories":["General","OBC","SC","ST","EWS"],"genderCriteria":"All","awardAmount":12000,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["NMMSS State Selection Examination Score Card","Class 8/9/10/11 Promotion Marksheet (min 55% aggregate)","Parental Income Certificate (under ₹3,50,000)","Aadhaar Seeded Bank Account Details"],"deadline":"2026-11-30","daysLeft":23,"officialSourceUrl":"https://scholarships.gov.in/","verificationStatus":"VERIFIED","academicYear":"2025-26","lastCheckedAt":"2026-11-06","applicationSteps":["Qualify in State NMMSS mental ability and scholastic aptitude test.","Submit renewal application on NSP with annual passing grade.","Direct disbursement into student DBT account."],"disclaimer":"Administered under Department of School Education guidelines via National Scholarship Portal.","tags":["Government","Ministry of Education","Merit-cum-Means","NSP"],"trustRating":5,"isSuspiciousWarning":false,"educationLevel":["Class 12 / Higher Secondary"]}'::jsonb
),
(
  'aicte-pragati-degree-girls',
  'AICTE Pragati Scholarship Scheme for Girl Students (Degree)',
  'All India Council for Technical Education (AICTE)',
  'Government',
  'Official AICTE flagship scholarship empowering meritorious young women pursuing undergraduate technical and engineering education in AICTE-approved institutions.',
  50000,
  'INR',
  ARRAY['Undergraduate'],
  ARRAY['B.Tech Computer Science', 'B.Tech IT', 'B.Tech Electronics', 'B.Tech Mechanical', 'B.Tech Civil', 'BCA', 'Engineering'],
  ARRAY['All India'],
  60,
  800000,
  ARRAY['Women in STEM', 'All'],
  'Female',
  ARRAY['10th and 12th Board Marksheet', 'AICTE Approved Institution Admission Allotment Letter', 'Annual Family Income Certificate issued by Tehsildar/Revenue Authority (under ₹8 Lakhs)', 'Bonafide Certificate issued by Head of Institution', 'Parental Declaration for single/maximum 2 girl children per family', 'Student Aadhaar Linked Savings Account Passbook'],
  '2026-12-31',
  54,
  'https://www.aicte-india.org/schemes/students-development-schemes/Pragati',
  'VERIFIED',
  '2025-26',
  ARRAY['AICTE', 'Women in Tech', 'Engineering', 'Pan-India', 'Government'],
  'Official AICTE scheme. Covers college fee payment, computer purchase, books and equipment.',
  5,
  '{"id":"aicte-pragati-degree-girls","name":"AICTE Pragati Scholarship Scheme for Girl Students (Degree)","provider":"All India Council for Technical Education (AICTE)","providerType":"Government","description":"Official AICTE flagship scholarship empowering meritorious young women pursuing undergraduate technical and engineering education in AICTE-approved institutions.","educationLevels":["Undergraduate"],"eligibleCourses":["B.Tech Computer Science","B.Tech IT","B.Tech Electronics","B.Tech Mechanical","B.Tech Civil","BCA","Engineering"],"eligibleStates":["All India"],"minMarks":60,"maxIncome":800000,"minimumMarks":60,"maximumFamilyIncome":800000,"categories":["Women in STEM","All"],"genderCriteria":"Female","awardAmount":50000,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["10th and 12th Board Marksheet","AICTE Approved Institution Admission Allotment Letter","Annual Family Income Certificate issued by Tehsildar/Revenue Authority (under ₹8 Lakhs)","Bonafide Certificate issued by Head of Institution","Parental Declaration for single/maximum 2 girl children per family","Student Aadhaar Linked Savings Account Passbook"],"deadline":"2026-12-31","daysLeft":54,"officialSourceUrl":"https://www.aicte-india.org/schemes/students-development-schemes/Pragati","verificationStatus":"VERIFIED","academicYear":"2025-26","lastCheckedAt":"2026-11-06","applicationSteps":["Enroll in 1st year B.Tech/B.E. or 2nd year through Lateral Entry in an AICTE accredited college.","Register on National Scholarship Portal under AICTE scheme portal.","Upload institute admission receipt and income documentation.","Principal/Director verifies application through online institutional dashboard."],"disclaimer":"Official AICTE scheme. Covers college fee payment, computer purchase, books and equipment.","tags":["AICTE","Women in Tech","Engineering","Pan-India","Government"],"trustRating":5,"isSuspiciousWarning":false,"educationLevel":["Undergraduate"]}'::jsonb
),
(
  'aicte-saksham-differently-abled',
  'AICTE Saksham Scholarship Scheme for Specially-Abled Students',
  'All India Council for Technical Education (AICTE)',
  'Government',
  'Government initiative to encourage specially-abled students with disability not less than 40% to pursue professional technical degree and diploma education.',
  50000,
  'INR',
  ARRAY['Undergraduate', 'Diploma / Polytechnic'],
  ARRAY['Engineering', 'Technology', 'Architecture', 'Pharmacy', 'All'],
  ARRAY['All India'],
  50,
  800000,
  ARRAY['Differently-Abled', 'All'],
  'All',
  ARRAY['Disability Certificate issued by Competent Medical Authority (min 40% disability)', 'Admission Letter to AICTE Approved Technical Institution', 'Current Year Income Certificate (under ₹8,00,000)', 'Class 10/12/Diploma Qualifying Marksheet', 'College Bonafide Certificate'],
  '2026-12-31',
  54,
  'https://www.aicte-india.org/schemes/students-development-schemes/Saksham',
  'VERIFIED',
  '2025-26',
  ARRAY['AICTE', 'Differently-Abled', 'Technical Education', 'Government'],
  'Official AICTE affirmative action initiative for specially-abled scholars.',
  5,
  '{"id":"aicte-saksham-differently-abled","name":"AICTE Saksham Scholarship Scheme for Specially-Abled Students","provider":"All India Council for Technical Education (AICTE)","providerType":"Government","description":"Government initiative to encourage specially-abled students with disability not less than 40% to pursue professional technical degree and diploma education.","educationLevels":["Undergraduate","Diploma / Polytechnic"],"eligibleCourses":["Engineering","Technology","Architecture","Pharmacy","All"],"eligibleStates":["All India"],"minMarks":50,"maxIncome":800000,"minimumMarks":50,"maximumFamilyIncome":800000,"categories":["Differently-Abled","All"],"genderCriteria":"All","awardAmount":50000,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["Disability Certificate issued by Competent Medical Authority (min 40% disability)","Admission Letter to AICTE Approved Technical Institution","Current Year Income Certificate (under ₹8,00,000)","Class 10/12/Diploma Qualifying Marksheet","College Bonafide Certificate"],"deadline":"2026-12-31","daysLeft":54,"officialSourceUrl":"https://www.aicte-india.org/schemes/students-development-schemes/Saksham","verificationStatus":"VERIFIED","academicYear":"2025-26","lastCheckedAt":"2026-11-06","applicationSteps":["Verify admission in 1st year technical program.","Submit digital application on National Scholarship Portal.","Attach valid medical disability certificate and income verification."],"disclaimer":"Official AICTE affirmative action initiative for specially-abled scholars.","tags":["AICTE","Differently-Abled","Technical Education","Government"],"trustRating":5,"isSuspiciousWarning":false,"educationLevel":["Undergraduate","Diploma / Polytechnic"]}'::jsonb
),
(
  'aicte-swanath-scheme',
  'AICTE Swanath Scholarship Scheme for Orphans and Wards of Armed Forces',
  'All India Council for Technical Education (AICTE)',
  'Government',
  'Financial assistance of ₹50,000 per annum to orphan children, candidates whose parents died due to Covid-19, or wards of Armed Forces and Central Paramilitary Forces personnel martyred in action.',
  50000,
  'INR',
  ARRAY['Undergraduate', 'Diploma / Polytechnic'],
  ARRAY['Engineering', 'Technology', 'Architecture', 'Management', 'All'],
  ARRAY['All India'],
  50,
  800000,
  ARRAY['All', 'First-Gen'],
  'All',
  ARRAY['Death Certificate of Parents or Armed Forces Martyred Certificate', 'AICTE College Admission Proof & Bonafide Certificate', 'Income Certificate (not applicable to orphans)', 'Qualifying Examination Marksheet'],
  '2026-12-31',
  54,
  'https://www.aicte-india.org/schemes/students-development-schemes/Swanath',
  'VERIFIED',
  '2025-26',
  ARRAY['AICTE', 'Welfare', 'Armed Forces', 'Pan-India'],
  'Dedicated welfare endowment administered by AICTE for eligible orphans and martyrs wards.',
  5,
  '{"id":"aicte-swanath-scheme","name":"AICTE Swanath Scholarship Scheme for Orphans and Wards of Armed Forces","provider":"All India Council for Technical Education (AICTE)","providerType":"Government","description":"Financial assistance of ₹50,000 per annum to orphan children, candidates whose parents died due to Covid-19, or wards of Armed Forces and Central Paramilitary Forces personnel martyred in action.","educationLevels":["Undergraduate","Diploma / Polytechnic"],"eligibleCourses":["Engineering","Technology","Architecture","Management","All"],"eligibleStates":["All India"],"minMarks":50,"maxIncome":800000,"minimumMarks":50,"maximumFamilyIncome":800000,"categories":["All","First-Gen"],"genderCriteria":"All","awardAmount":50000,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["Death Certificate of Parents or Armed Forces Martyred Certificate","AICTE College Admission Proof & Bonafide Certificate","Income Certificate (not applicable to orphans)","Qualifying Examination Marksheet"],"deadline":"2026-12-31","daysLeft":54,"officialSourceUrl":"https://www.aicte-india.org/schemes/students-development-schemes/Swanath","verificationStatus":"VERIFIED","academicYear":"2025-26","lastCheckedAt":"2026-11-06","applicationSteps":["Register on National Scholarship Portal under AICTE Swanath scheme section.","Submit designated verification certificates.","Institution nodal officer confirms enrollment."],"disclaimer":"Dedicated welfare endowment administered by AICTE for eligible orphans and martyrs wards.","tags":["AICTE","Welfare","Armed Forces","Pan-India"],"trustRating":5,"isSuspiciousWarning":false,"educationLevel":["Undergraduate","Diploma / Polytechnic"]}'::jsonb
),
(
  'ekalyan-jharkhand-post-matric',
  'Jharkhand e-Kalyan Post-Matric Scholarship Scheme',
  'Welfare Department, Government of Jharkhand',
  'Government',
  'Comprehensive tuition and maintenance fellowship for permanent residents of Jharkhand State belonging to Scheduled Tribe, Scheduled Caste, and Backward Classes (OBC) studying in accredited colleges.',
  48000,
  'INR',
  ARRAY['Class 12 / Higher Secondary', 'Undergraduate', 'Postgraduate', 'Diploma / Polytechnic', 'Doctoral / PhD'],
  ARRAY['B.Tech Computer Science', 'B.Tech IT', 'B.Sc Agriculture', 'Medicine', 'Commerce', 'Arts', 'All'],
  ARRAY['Jharkhand'],
  50,
  250000,
  ARRAY['SC', 'ST', 'OBC'],
  'All',
  ARRAY['Residential / Domicile Certificate issued by Circle Officer / SDO / DC Jharkhand', 'Caste Certificate with valid Online Jharsewa Verification ID', 'Current Financial Year Income Certificate issued by competent authority', 'College Bonafide Certificate with institutional Fee Structure', 'Previous Qualifying Examination Marksheet', 'Aadhaar Linked Bank Account Details'],
  '2027-01-31',
  85,
  'https://ekalyan.cgg.gov.in/',
  'VERIFIED',
  '2025-26',
  ARRAY['e-Kalyan', 'Jharkhand Domicile', 'SC/ST/OBC', 'State Government'],
  'Official Jharkhand State Government welfare scheme. Domicile certificate from Jharkhand State is strictly mandatory.',
  5,
  '{"id":"ekalyan-jharkhand-post-matric","name":"Jharkhand e-Kalyan Post-Matric Scholarship Scheme","provider":"Welfare Department, Government of Jharkhand","providerType":"Government","description":"Comprehensive tuition and maintenance fellowship for permanent residents of Jharkhand State belonging to Scheduled Tribe, Scheduled Caste, and Backward Classes (OBC) studying in accredited colleges.","educationLevels":["Class 12 / Higher Secondary","Undergraduate","Postgraduate","Diploma / Polytechnic","Doctoral / PhD"],"eligibleCourses":["B.Tech Computer Science","B.Tech IT","B.Sc Agriculture","Medicine","Commerce","Arts","All"],"eligibleStates":["Jharkhand"],"minMarks":50,"maxIncome":250000,"minimumMarks":50,"maximumFamilyIncome":250000,"categories":["SC","ST","OBC"],"genderCriteria":"All","awardAmount":48000,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["Residential / Domicile Certificate issued by Circle Officer / SDO / DC Jharkhand","Caste Certificate with valid Online Jharsewa Verification ID","Current Financial Year Income Certificate issued by competent authority","College Bonafide Certificate with institutional Fee Structure","Previous Qualifying Examination Marksheet","Aadhaar Linked Bank Account Details"],"deadline":"2027-01-31","daysLeft":85,"officialSourceUrl":"https://ekalyan.cgg.gov.in/","verificationStatus":"VERIFIED","academicYear":"2025-26","lastCheckedAt":"2026-11-06","applicationSteps":["Register on Jharkhand e-Kalyan portal (ekalyan.cgg.gov.in) with Aadhaar.","Enter Jharsewa certificate numbers for automatic barcode verification.","Upload original scanned copies of Bonafide Certificate and Fee Structure.","College and District Welfare Officer (DWO) execute two-level online approval."],"disclaimer":"Official Jharkhand State Government welfare scheme. Domicile certificate from Jharkhand State is strictly mandatory.","tags":["e-Kalyan","Jharkhand Domicile","SC/ST/OBC","State Government"],"trustRating":5,"isSuspiciousWarning":false,"educationLevel":["Class 12 / Higher Secondary","Undergraduate","Postgraduate","Diploma / Polytechnic","Doctoral / PhD"]}'::jsonb
),
(
  'ekalyan-cm-fellowship-pending',
  'Jharkhand Chief Minister Higher Education Fellowship',
  'Department of Higher & Technical Education, Government of Jharkhand',
  'Government',
  'Proposed state fellowship announced for top-ranking technical and research scholars across Jharkhand universities. Official guidelines and portal submission window are undergoing departmental notification.',
  75000,
  'INR',
  ARRAY['Postgraduate', 'Doctoral / PhD'],
  ARRAY['Engineering', 'Data Science', 'Sciences', 'All'],
  ARRAY['Jharkhand'],
  75,
  500000,
  ARRAY['All'],
  'All',
  ARRAY['Jharkhand Domicile Certificate', 'Postgraduate Degree Marksheets', 'Research Proposal / Enrollment Proof'],
  'Application Window Awaiting Notification',
  90,
  'https://ekalyan.cgg.gov.in/',
  'PENDING_VERIFICATION',
  '2025-26',
  ARRAY['Pending Verification', 'Jharkhand', 'Research'],
  'Notice: Official department circular identified, but online registration guidelines are awaiting formal verification on the portal. Excluded from verified matching.',
  3,
  '{"id":"ekalyan-cm-fellowship-pending","name":"Jharkhand Chief Minister Higher Education Fellowship","provider":"Department of Higher & Technical Education, Government of Jharkhand","providerType":"Government","description":"Proposed state fellowship announced for top-ranking technical and research scholars across Jharkhand universities. Official guidelines and portal submission window are undergoing departmental notification.","educationLevels":["Postgraduate","Doctoral / PhD"],"eligibleCourses":["Engineering","Data Science","Sciences","All"],"eligibleStates":["Jharkhand"],"minMarks":75,"maxIncome":500000,"minimumMarks":75,"maximumFamilyIncome":500000,"categories":["All"],"genderCriteria":"All","awardAmount":75000,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["Jharkhand Domicile Certificate","Postgraduate Degree Marksheets","Research Proposal / Enrollment Proof"],"deadline":"Application Window Awaiting Notification","daysLeft":90,"officialSourceUrl":"https://ekalyan.cgg.gov.in/","verificationStatus":"PENDING_VERIFICATION","academicYear":"2025-26","lastCheckedAt":"2026-11-06","applicationSteps":["State notification published in educational circulars.","Portal registration module currently under deployment."],"disclaimer":"Notice: Official department circular identified, but online registration guidelines are awaiting formal verification on the portal. Excluded from verified matching.","tags":["Pending Verification","Jharkhand","Research"],"trustRating":3,"isSuspiciousWarning":false,"educationLevel":["Postgraduate","Doctoral / PhD"]}'::jsonb
),
(
  'aicte-fellowship-stem-pending',
  'AICTE Post Graduate Scholarship (Special Research Cohort)',
  'All India Council for Technical Education (AICTE)',
  'Government',
  'Endowment for GATE and CEED qualified candidates admitted to AICTE approved postgraduate technical institutions. Ongoing verification for current mid-term revised allotment circular.',
  148800,
  'INR',
  ARRAY['Postgraduate', 'Doctoral / PhD'],
  ARRAY['M.Tech AI', 'M.Tech Computer Science', 'M.Tech Electronics'],
  ARRAY['All India'],
  70,
  800000,
  ARRAY['All'],
  'All',
  ARRAY['Valid GATE / CEED Scorecard', 'AICTE PG College Admission Receipt', 'Degree Marksheets'],
  'Check Portal for Allotment Notification',
  60,
  'https://www.aicte-india.org/',
  'PENDING_VERIFICATION',
  '2025-26',
  ARRAY['AICTE', 'GATE', 'Pending Verification'],
  'Pending Verification: Awaiting official circular release on aicte-india.org for the mid-year batch. Excluded from verified matching recommendations.',
  3,
  '{"id":"aicte-fellowship-stem-pending","name":"AICTE Post Graduate Scholarship (Special Research Cohort)","provider":"All India Council for Technical Education (AICTE)","providerType":"Government","description":"Endowment for GATE and CEED qualified candidates admitted to AICTE approved postgraduate technical institutions. Ongoing verification for current mid-term revised allotment circular.","educationLevels":["Postgraduate","Doctoral / PhD"],"eligibleCourses":["M.Tech AI","M.Tech Computer Science","M.Tech Electronics"],"eligibleStates":["All India"],"minMarks":70,"maxIncome":800000,"minimumMarks":70,"maximumFamilyIncome":800000,"categories":["All"],"genderCriteria":"All","awardAmount":148800,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["Valid GATE / CEED Scorecard","AICTE PG College Admission Receipt","Degree Marksheets"],"deadline":"Check Portal for Allotment Notification","daysLeft":60,"officialSourceUrl":"https://www.aicte-india.org/","verificationStatus":"PENDING_VERIFICATION","academicYear":"2025-26","lastCheckedAt":"2026-11-06","applicationSteps":["Check AICTE official announcements for portal submission dates."],"disclaimer":"Pending Verification: Awaiting official circular release on aicte-india.org for the mid-year batch. Excluded from verified matching recommendations.","tags":["AICTE","GATE","Pending Verification"],"trustRating":3,"isSuspiciousWarning":false,"educationLevel":["Postgraduate","Doctoral / PhD"]}'::jsonb
),
(
  'aicte-pragati-2024-closed',
  'AICTE Pragati Scholarship for Girls (2024-25 Concluded Cycle)',
  'All India Council for Technical Education (AICTE)',
  'Government',
  'Archived scholarship listing for the previous academic cycle. Applications for this batch closed on November 30, 2024. Displayed for historical records only.',
  50000,
  'INR',
  ARRAY['Undergraduate'],
  ARRAY['Engineering', 'Technology'],
  ARRAY['All India'],
  60,
  800000,
  ARRAY['Women in STEM'],
  'Female',
  ARRAY['Historical record documents'],
  '2024-11-30 (Closed)',
  0,
  'https://www.aicte-india.org/schemes/students-development-schemes/Pragati',
  'EXPIRED_OR_CLOSED',
  '2024-25',
  ARRAY['Archived', 'AICTE', 'Closed'],
  'Official Portal Record: Application cycle for academic year 2024-25 has concluded. Not eligible for new submissions.',
  2,
  '{"id":"aicte-pragati-2024-closed","name":"AICTE Pragati Scholarship for Girls (2024-25 Concluded Cycle)","provider":"All India Council for Technical Education (AICTE)","providerType":"Government","description":"Archived scholarship listing for the previous academic cycle. Applications for this batch closed on November 30, 2024. Displayed for historical records only.","educationLevels":["Undergraduate"],"eligibleCourses":["Engineering","Technology"],"eligibleStates":["All India"],"minMarks":60,"maxIncome":800000,"minimumMarks":60,"maximumFamilyIncome":800000,"categories":["Women in STEM"],"genderCriteria":"Female","awardAmount":50000,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["Historical record documents"],"deadline":"2024-11-30 (Closed)","daysLeft":0,"officialSourceUrl":"https://www.aicte-india.org/schemes/students-development-schemes/Pragati","verificationStatus":"EXPIRED_OR_CLOSED","academicYear":"2024-25","lastCheckedAt":"2026-11-06","applicationSteps":["Cycle concluded on official portal."],"disclaimer":"Official Portal Record: Application cycle for academic year 2024-25 has concluded. Not eligible for new submissions.","tags":["Archived","AICTE","Closed"],"trustRating":2,"isSuspiciousWarning":false,"educationLevel":["Undergraduate"]}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  provider = EXCLUDED.provider,
  award_amount = EXCLUDED.award_amount,
  deadline = EXCLUDED.deadline,
  verification_status = EXCLUDED.verification_status,
  data = EXCLUDED.data,
  updated_at = now();
