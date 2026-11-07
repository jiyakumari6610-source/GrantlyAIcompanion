CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Own profile delete" ON public.profiles FOR DELETE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.scholarships (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scholarships TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scholarships TO authenticated;
GRANT ALL ON public.scholarships TO service_role;
ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads scholarships" ON public.scholarships FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert scholarships" ON public.scholarships FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update scholarships" ON public.scholarships FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete scholarships" ON public.scholarships FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.applications (
  user_id uuid NOT NULL,
  id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own applications" ON public.applications FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.saved_scholarships (
  user_id uuid NOT NULL,
  scholarship_id text NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scholarship_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_scholarships TO authenticated;
GRANT ALL ON public.saved_scholarships TO service_role;
ALTER TABLE public.saved_scholarships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own saved" ON public.saved_scholarships FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.documents (
  user_id uuid NOT NULL,
  id text NOT NULL,
  storage_path text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own documents" ON public.documents FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.reports (
  id text PRIMARY KEY,
  scholarship_id text NOT NULL,
  reason text NOT NULL,
  reported_by uuid,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon submit report" ON public.reports FOR INSERT TO anon WITH CHECK (reported_by IS NULL);
CREATE POLICY "User submit report" ON public.reports FOR INSERT TO authenticated WITH CHECK (reported_by IS NULL OR reported_by = auth.uid());
CREATE POLICY "Admins read reports" ON public.reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update reports" ON public.reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete reports" ON public.reports FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.grant_admin_on_confirm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND lower(NEW.email) = 'jiya72637@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_admin_grant
AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_on_confirm();

CREATE POLICY "Own files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own files update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

INSERT INTO public.scholarships (id, data) VALUES
('nsp-post-matric-sc', '{"id":"nsp-post-matric-sc","name":"Centrally Sponsored Post Matric Scholarship for SC Students","provider":"Department of Social Justice & Empowerment, Government of India","providerType":"Government","description":"Statutory scheme providing complete financial assistance for Scheduled Caste students pursuing post-matriculation or post-secondary courses across recognized higher educational institutions.","educationLevels":["Class 12 / Higher Secondary","Undergraduate","Postgraduate","Diploma / Polytechnic","Doctoral / PhD"],"eligibleCourses":["All","Engineering","Medicine","Commerce","Sciences","Arts"],"eligibleStates":["All India"],"minMarks":0,"maxIncome":250000,"minimumMarks":0,"maximumFamilyIncome":250000,"categories":["SC"],"genderCriteria":"All","awardAmount":65000,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["Aadhaar Card","Caste Certificate issued by Competent Authority","Current Financial Year Income Certificate (under ₹2.5L)","Previous Examination Marksheet","College Bonafide Student Certificate","Bank Passbook linked to Aadhaar (DBT active)"],"deadline":"2026-12-31","daysLeft":54,"officialSourceUrl":"https://scholarships.gov.in/","verificationStatus":"VERIFIED","academicYear":"2025-26","lastCheckedAt":"2026-11-06","applicationSteps":["Register on the National Scholarship Portal (scholarships.gov.in) with Aadhaar verification.","Select Department of Social Justice & Empowerment scheme list.","Enter Institutional AISHE/U-DISE code and upload verified Caste & Income certificates.","Institute Nodal Officer (INO) and District Nodal Officer (DNO) complete biometric verification."],"disclaimer":"Official Central Government statutory scheme. Disbursement executed through Aadhaar-based Direct Benefit Transfer (DBT).","tags":["Government","NSP","SC","Pan-India","Post-Matric"],"trustRating":5,"isSuspiciousWarning":false,"educationLevel":["Class 12 / Higher Secondary","Undergraduate","Postgraduate","Diploma / Polytechnic","Doctoral / PhD"],"createdAt":"2026-11-07T00:00:00.000Z","updatedAt":"2026-11-07T00:00:00.000Z"}'::jsonb),
('nsp-post-matric-minorities', '{"id":"nsp-post-matric-minorities","name":"Post Matric Scholarships Scheme for Minorities","provider":"Ministry of Minority Affairs, Government of India","providerType":"Government","description":"Financial support to meritorious students belonging to notified minority communities (Muslim, Christian, Sikh, Buddhist, Jain, Parsi) for higher secondary, undergraduate, and postgraduate studies.","educationLevels":["Class 12 / Higher Secondary","Undergraduate","Postgraduate","Diploma / Polytechnic","Doctoral / PhD"],"eligibleCourses":["All","Engineering","Sciences","Commerce","Humanities","Medicine"],"eligibleStates":["All India"],"minMarks":50,"maxIncome":200000,"minimumMarks":50,"maximumFamilyIncome":200000,"categories":["All"],"genderCriteria":"All","awardAmount":30000,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["Aadhaar / National Identification Proof","Self-Declaration of Minority Community Certificate","Latest Year Marksheet with minimum 50% marks","Income Certificate issued by Tehsildar / SDO","Institution Fee Receipt & Bonafide Certificate"],"deadline":"2026-12-15","daysLeft":38,"officialSourceUrl":"https://scholarships.gov.in/","verificationStatus":"VERIFIED","academicYear":"2025-26","lastCheckedAt":"2026-11-06","applicationSteps":["Authenticate with One-Time Registration (OTR) on scholarships.gov.in.","Fill Academic & Family Income details.","Upload minority self-declaration and fee structure.","Submit for institutional scrutiny."],"disclaimer":"Official Ministry of Minority Affairs scheme. 30% quota earmarked for female students.","tags":["Government","NSP","Minority Affairs","Pan-India"],"trustRating":5,"isSuspiciousWarning":false,"educationLevel":["Class 12 / Higher Secondary","Undergraduate","Postgraduate","Diploma / Polytechnic","Doctoral / PhD"],"createdAt":"2026-11-07T00:00:00.000Z","updatedAt":"2026-11-07T00:00:00.000Z"}'::jsonb),
('nsp-nmmss-merit-means', '{"id":"nsp-nmmss-merit-means","name":"National Means-cum-Merit Scholarship Scheme (NMMSS)","provider":"Department of School Education & Literacy, Ministry of Education","providerType":"Government","description":"Central sector scholarship award designed to prevent school dropouts among meritorious students from economically weaker sections continuing into higher secondary education.","educationLevels":["Class 12 / Higher Secondary"],"eligibleCourses":["Sciences","Commerce","Arts","All"],"eligibleStates":["All India"],"minMarks":55,"maxIncome":350000,"minimumMarks":55,"maximumFamilyIncome":350000,"categories":["General","OBC","SC","ST","EWS"],"genderCriteria":"All","awardAmount":12000,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["NMMSS State Selection Examination Score Card","Class 8/9/10/11 Promotion Marksheet (min 55% aggregate)","Parental Income Certificate (under ₹3,50,000)","Aadhaar Seeded Bank Account Details"],"deadline":"2026-11-30","daysLeft":23,"officialSourceUrl":"https://scholarships.gov.in/","verificationStatus":"VERIFIED","academicYear":"2025-26","lastCheckedAt":"2026-11-06","applicationSteps":["Qualify in State NMMSS mental ability and scholastic aptitude test.","Submit renewal application on NSP with annual passing grade.","Direct disbursement into student DBT account."],"disclaimer":"Administered under Department of School Education guidelines via National Scholarship Portal.","tags":["Government","Ministry of Education","Merit-cum-Means","NSP"],"trustRating":5,"isSuspiciousWarning":false,"educationLevel":["Class 12 / Higher Secondary"],"createdAt":"2026-11-07T00:00:00.000Z","updatedAt":"2026-11-07T00:00:00.000Z"}'::jsonb),
('aicte-pragati-degree-girls', '{"id":"aicte-pragati-degree-girls","name":"AICTE Pragati Scholarship Scheme for Girl Students (Degree)","provider":"All India Council for Technical Education (AICTE)","providerType":"Government","description":"Official AICTE flagship scholarship empowering meritorious young women pursuing undergraduate technical and engineering education in AICTE-approved institutions.","educationLevels":["Undergraduate"],"eligibleCourses":["B.Tech Computer Science","B.Tech IT","B.Tech Electronics","B.Tech Mechanical","B.Tech Civil","BCA","Engineering"],"eligibleStates":["All India"],"minMarks":60,"maxIncome":800000,"minimumMarks":60,"maximumFamilyIncome":800000,"categories":["Women in STEM","All"],"genderCriteria":"Female","awardAmount":50000,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["10th and 12th Board Marksheet","AICTE Approved Institution Admission Allotment Letter","Annual Family Income Certificate issued by Tehsildar/Revenue Authority (under ₹8 Lakhs)","Bonafide Certificate issued by Head of Institution","Parental Declaration for single/maximum 2 girl children per family","Student Aadhaar Linked Savings Account Passbook"],"deadline":"2026-12-31","daysLeft":54,"officialSourceUrl":"https://www.aicte-india.org/schemes/students-development-schemes/Pragati","verificationStatus":"VERIFIED","academicYear":"2025-26","lastCheckedAt":"2026-11-06","applicationSteps":["Enroll in 1st year B.Tech/B.E. or 2nd year through Lateral Entry in an AICTE accredited college.","Register on National Scholarship Portal under AICTE scheme portal.","Upload institute admission receipt and income documentation.","Principal/Director verifies application through online institutional dashboard."],"disclaimer":"Official AICTE scheme. Covers college fee payment, computer purchase, books and equipment.","tags":["AICTE","Women in Tech","Engineering","Pan-India","Government"],"trustRating":5,"isSuspiciousWarning":false,"educationLevel":["Undergraduate"],"createdAt":"2026-11-07T00:00:00.000Z","updatedAt":"2026-11-07T00:00:00.000Z"}'::jsonb),
('aicte-saksham-differently-abled', '{"id":"aicte-saksham-differently-abled","name":"AICTE Saksham Scholarship Scheme for Specially-Abled Students","provider":"All India Council for Technical Education (AICTE)","providerType":"Government","description":"Government initiative to encourage specially-abled students with disability not less than 40% to pursue professional technical degree and diploma education.","educationLevels":["Undergraduate","Diploma / Polytechnic"],"eligibleCourses":["Engineering","Technology","Architecture","Pharmacy","All"],"eligibleStates":["All India"],"minMarks":50,"maxIncome":800000,"minimumMarks":50,"maximumFamilyIncome":800000,"categories":["Differently-Abled","All"],"genderCriteria":"All","awardAmount":50000,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["Disability Certificate issued by Competent Medical Authority (min 40% disability)","Admission Letter to AICTE Approved Technical Institution","Current Year Income Certificate (under ₹8,00,000)","Class 10/12/Diploma Qualifying Marksheet","College Bonafide Certificate"],"deadline":"2026-12-31","daysLeft":54,"officialSourceUrl":"https://www.aicte-india.org/schemes/students-development-schemes/Saksham","verificationStatus":"VERIFIED","academicYear":"2025-26","lastCheckedAt":"2026-11-06","applicationSteps":["Verify admission in 1st year technical program.","Submit digital application on National Scholarship Portal.","Attach valid medical disability certificate and income verification."],"disclaimer":"Official AICTE affirmative action initiative for specially-abled scholars.","tags":["AICTE","Differently-Abled","Technical Education","Government"],"trustRating":5,"isSuspiciousWarning":false,"educationLevel":["Undergraduate","Diploma / Polytechnic"],"createdAt":"2026-11-07T00:00:00.000Z","updatedAt":"2026-11-07T00:00:00.000Z"}'::jsonb),
('aicte-swanath-scheme', '{"id":"aicte-swanath-scheme","name":"AICTE Swanath Scholarship Scheme for Orphans and Wards of Armed Forces","provider":"All India Council for Technical Education (AICTE)","providerType":"Government","description":"Financial assistance of ₹50,000 per annum to orphan children, candidates whose parents died due to Covid-19, or wards of Armed Forces and Central Paramilitary Forces personnel martyred in action.","educationLevels":["Undergraduate","Diploma / Polytechnic"],"eligibleCourses":["Engineering","Technology","Architecture","Management","All"],"eligibleStates":["All India"],"minMarks":50,"maxIncome":800000,"minimumMarks":50,"maximumFamilyIncome":800000,"categories":["All","First-Gen"],"genderCriteria":"All","awardAmount":50000,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["Death Certificate of Parents or Armed Forces Martyred Certificate","AICTE College Admission Proof & Bonafide Certificate","Income Certificate (not applicable to orphans)","Qualifying Examination Marksheet"],"deadline":"2026-12-31","daysLeft":54,"officialSourceUrl":"https://www.aicte-india.org/schemes/students-development-schemes/Swanath","verificationStatus":"VERIFIED","academicYear":"2025-26","lastCheckedAt":"2026-11-06","applicationSteps":["Register on National Scholarship Portal under AICTE Swanath scheme section.","Submit designated verification certificates.","Institution nodal officer confirms enrollment."],"disclaimer":"Dedicated welfare endowment administered by AICTE for eligible orphans and martyrs wards.","tags":["AICTE","Welfare","Armed Forces","Pan-India"],"trustRating":5,"isSuspiciousWarning":false,"educationLevel":["Undergraduate","Diploma / Polytechnic"],"createdAt":"2026-11-07T00:00:00.000Z","updatedAt":"2026-11-07T00:00:00.000Z"}'::jsonb),
('ekalyan-jharkhand-post-matric', '{"id":"ekalyan-jharkhand-post-matric","name":"Jharkhand e-Kalyan Post-Matric Scholarship Scheme","provider":"Welfare Department, Government of Jharkhand","providerType":"Government","description":"Comprehensive tuition and maintenance fellowship for permanent residents of Jharkhand State belonging to Scheduled Tribe, Scheduled Caste, and Backward Classes (OBC) studying in accredited colleges.","educationLevels":["Class 12 / Higher Secondary","Undergraduate","Postgraduate","Diploma / Polytechnic","Doctoral / PhD"],"eligibleCourses":["B.Tech Computer Science","B.Tech IT","B.Sc Agriculture","Medicine","Commerce","Arts","All"],"eligibleStates":["Jharkhand"],"minMarks":50,"maxIncome":250000,"minimumMarks":50,"maximumFamilyIncome":250000,"categories":["SC","ST","OBC"],"genderCriteria":"All","awardAmount":48000,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["Residential / Domicile Certificate issued by Circle Officer / SDO / DC Jharkhand","Caste Certificate with valid Online Jharsewa Verification ID","Current Financial Year Income Certificate issued by competent authority","College Bonafide Certificate with institutional Fee Structure","Previous Qualifying Examination Marksheet","Aadhaar Linked Bank Account Details"],"deadline":"2027-01-31","daysLeft":85,"officialSourceUrl":"https://ekalyan.cgg.gov.in/","verificationStatus":"VERIFIED","academicYear":"2025-26","lastCheckedAt":"2026-11-06","applicationSteps":["Register on Jharkhand e-Kalyan portal (ekalyan.cgg.gov.in) with Aadhaar.","Enter Jharsewa certificate numbers for automatic barcode verification.","Upload original scanned copies of Bonafide Certificate and Fee Structure.","College and District Welfare Officer (DWO) execute two-level online approval."],"disclaimer":"Official Jharkhand State Government welfare scheme. Domicile certificate from Jharkhand State is strictly mandatory.","tags":["e-Kalyan","Jharkhand Domicile","SC/ST/OBC","State Government"],"trustRating":5,"isSuspiciousWarning":false,"educationLevel":["Class 12 / Higher Secondary","Undergraduate","Postgraduate","Diploma / Polytechnic","Doctoral / PhD"],"createdAt":"2026-11-07T00:00:00.000Z","updatedAt":"2026-11-07T00:00:00.000Z"}'::jsonb),
('ekalyan-cm-fellowship-pending', '{"id":"ekalyan-cm-fellowship-pending","name":"Jharkhand Chief Minister Higher Education Fellowship","provider":"Department of Higher & Technical Education, Government of Jharkhand","providerType":"Government","description":"Proposed state fellowship announced for top-ranking technical and research scholars across Jharkhand universities. Official guidelines and portal submission window are undergoing departmental notification.","educationLevels":["Postgraduate","Doctoral / PhD"],"eligibleCourses":["Engineering","Data Science","Sciences","All"],"eligibleStates":["Jharkhand"],"minMarks":75,"maxIncome":500000,"minimumMarks":75,"maximumFamilyIncome":500000,"categories":["All"],"genderCriteria":"All","awardAmount":75000,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["Jharkhand Domicile Certificate","Postgraduate Degree Marksheets","Research Proposal / Enrollment Proof"],"deadline":"Application Window Awaiting Notification","daysLeft":90,"officialSourceUrl":"https://ekalyan.cgg.gov.in/","verificationStatus":"PENDING_VERIFICATION","academicYear":"2025-26","lastCheckedAt":"2026-11-06","applicationSteps":["State notification published in educational circulars.","Portal registration module currently under deployment."],"disclaimer":"Notice: Official department circular identified, but online registration guidelines are awaiting formal verification on the portal. Excluded from verified matching.","tags":["Pending Verification","Jharkhand","Research"],"trustRating":3,"isSuspiciousWarning":false,"educationLevel":["Postgraduate","Doctoral / PhD"],"createdAt":"2026-11-07T00:00:00.000Z","updatedAt":"2026-11-07T00:00:00.000Z"}'::jsonb),
('aicte-fellowship-stem-pending', '{"id":"aicte-fellowship-stem-pending","name":"AICTE Post Graduate Scholarship (Special Research Cohort)","provider":"All India Council for Technical Education (AICTE)","providerType":"Government","description":"Endowment for GATE and CEED qualified candidates admitted to AICTE approved postgraduate technical institutions. Ongoing verification for current mid-term revised allotment circular.","educationLevels":["Postgraduate","Doctoral / PhD"],"eligibleCourses":["M.Tech AI","M.Tech Computer Science","M.Tech Electronics"],"eligibleStates":["All India"],"minMarks":70,"maxIncome":800000,"minimumMarks":70,"maximumFamilyIncome":800000,"categories":["All"],"genderCriteria":"All","awardAmount":148800,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["Valid GATE / CEED Scorecard","AICTE PG College Admission Receipt","Degree Marksheets"],"deadline":"Check Portal for Allotment Notification","daysLeft":60,"officialSourceUrl":"https://www.aicte-india.org/","verificationStatus":"PENDING_VERIFICATION","academicYear":"2025-26","lastCheckedAt":"2026-11-06","applicationSteps":["Check AICTE official announcements for portal submission dates."],"disclaimer":"Pending Verification: Awaiting official circular release on aicte-india.org for the mid-year batch. Excluded from verified matching recommendations.","tags":["AICTE","GATE","Pending Verification"],"trustRating":3,"isSuspiciousWarning":false,"educationLevel":["Postgraduate","Doctoral / PhD"],"createdAt":"2026-11-07T00:00:00.000Z","updatedAt":"2026-11-07T00:00:00.000Z"}'::jsonb),
('aicte-pragati-2024-closed', '{"id":"aicte-pragati-2024-closed","name":"AICTE Pragati Scholarship for Girls (2024-25 Concluded Cycle)","provider":"All India Council for Technical Education (AICTE)","providerType":"Government","description":"Archived scholarship listing for the previous academic cycle. Applications for this batch closed on November 30, 2024. Displayed for historical records only.","educationLevels":["Undergraduate"],"eligibleCourses":["Engineering","Technology"],"eligibleStates":["All India"],"minMarks":60,"maxIncome":800000,"minimumMarks":60,"maximumFamilyIncome":800000,"categories":["Women in STEM"],"genderCriteria":"Female","awardAmount":50000,"currency":"INR","awardFrequency":"Annual","requiredDocuments":["Historical record documents"],"deadline":"2024-11-30 (Closed)","daysLeft":0,"officialSourceUrl":"https://www.aicte-india.org/schemes/students-development-schemes/Pragati","verificationStatus":"EXPIRED_OR_CLOSED","academicYear":"2024-25","lastCheckedAt":"2026-11-06","applicationSteps":["Cycle concluded on official portal."],"disclaimer":"Official Portal Record: Application cycle for academic year 2024-25 has concluded. Not eligible for new submissions.","tags":["Archived","AICTE","Closed"],"trustRating":2,"isSuspiciousWarning":false,"educationLevel":["Undergraduate"],"createdAt":"2026-11-07T00:00:00.000Z","updatedAt":"2026-11-07T00:00:00.000Z"}'::jsonb)
ON CONFLICT (id) DO NOTHING;