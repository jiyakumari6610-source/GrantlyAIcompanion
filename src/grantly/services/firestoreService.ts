/**
 * Grantly repository services, backed by Lovable Cloud tables.
 * Signatures match the original Firestore-backed module.
 */
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import {
  UserProfileDocument,
  ScholarshipDocument,
  ApplicationHistoryRecord,
  DocumentMetadataRecord,
  ReportRecord,
  validateUserProfile,
  validateApplication,
} from '../types/firestore';

const j = (v: unknown) => v as unknown as Json;

// 1. STUDENT PROFILE
export async function createStudentProfile(uid: string, profileData: UserProfileDocument): Promise<void> {
  if (!uid) throw new Error('Valid authenticated UID is required to create student profile.');
  const validation = validateUserProfile(profileData);
  if (!validation.isValid) throw new Error(`Profile validation failed: ${Object.values(validation.errors).join(' ')}`);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: uid, data: j({ ...profileData, createdAt: profileData.createdAt || now, updatedAt: now }) });
  if (error) throw error;
}

export async function readStudentProfile(uid: string): Promise<UserProfileDocument | null> {
  if (!uid) return null;
  const { data, error } = await supabase.from('profiles').select('data').eq('id', uid).maybeSingle();
  if (error) throw error;
  return data ? (data.data as unknown as UserProfileDocument) : null;
}

export async function updateStudentProfile(uid: string, updates: Partial<UserProfileDocument>): Promise<void> {
  if (!uid) throw new Error('Valid authenticated UID is required to update student profile.');
  const validation = validateUserProfile(updates);
  if (!validation.isValid) throw new Error(`Profile update validation failed: ${Object.values(validation.errors).join(' ')}`);
  const existing = (await readStudentProfile(uid)) || {};
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: uid, data: j({ ...existing, ...updates, updatedAt: new Date().toISOString() }), updated_at: new Date().toISOString() });
  if (error) throw error;
}

// 2. SCHOLARSHIPS
export async function fetchScholarships(filterStatus?: string): Promise<ScholarshipDocument[]> {
  const { data, error } = await supabase.from('scholarships').select('id, data');
  if (error) throw error;
  const list = (data || []).map((r) => ({ ...(r.data as object), id: r.id }) as ScholarshipDocument);
  return filterStatus ? list.filter((s) => s.verificationStatus === filterStatus) : list;
}

export async function fetchScholarshipById(scholarshipId: string): Promise<ScholarshipDocument | null> {
  if (!scholarshipId) return null;
  const { data, error } = await supabase.from('scholarships').select('id, data').eq('id', scholarshipId).maybeSingle();
  if (error) throw error;
  return data ? ({ ...(data.data as object), id: data.id } as ScholarshipDocument) : null;
}

export async function createScholarshipRecord(scholarshipData: ScholarshipDocument): Promise<void> {
  const schemeId = (scholarshipData.id || '').trim();
  if (!schemeId) throw new Error('Valid scheme ID is required to create a scholarship.');
  const now = new Date().toISOString();
  const { error } = await supabase.from('scholarships').insert({
    id: schemeId,
    data: j({ ...scholarshipData, id: schemeId, createdAt: scholarshipData.createdAt || now, updatedAt: now }),
  });
  if (error) throw error;
}

export async function updateScholarshipRecord(scholarshipId: string, updates: Partial<ScholarshipDocument>): Promise<void> {
  if (!scholarshipId) throw new Error('Valid scholarship ID is required to update.');
  const existing = await fetchScholarshipById(scholarshipId);
  if (!existing) throw new Error('Scholarship not found');
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('scholarships')
    .update({ data: j({ ...existing, ...updates, updatedAt: now }), updated_at: now })
    .eq('id', scholarshipId);
  if (error) throw error;
}

export async function deleteScholarshipRecord(scholarshipId: string): Promise<void> {
  if (!scholarshipId) throw new Error('Valid scholarship ID is required to delete.');
  const { error } = await supabase.from('scholarships').delete().eq('id', scholarshipId);
  if (error) throw error;
}

// 3. SAVED SCHOLARSHIPS
export async function saveScholarshipForUser(uid: string, scholarshipId: string): Promise<void> {
  if (!uid || !scholarshipId) throw new Error('Both UID and scholarshipId are required to bookmark a scholarship.');
  const { error } = await supabase
    .from('saved_scholarships')
    .upsert({ user_id: uid, scholarship_id: scholarshipId });
  if (error) throw error;
}

export async function removeSavedScholarshipForUser(uid: string, scholarshipId: string): Promise<void> {
  if (!uid || !scholarshipId) throw new Error('Both UID and scholarshipId are required to remove a bookmarked scholarship.');
  const { error } = await supabase.from('saved_scholarships').delete().eq('user_id', uid).eq('scholarship_id', scholarshipId);
  if (error) throw error;
}

export async function readSavedScholarshipsForUser(uid: string): Promise<string[]> {
  if (!uid) return [];
  const { data, error } = await supabase.from('saved_scholarships').select('scholarship_id').eq('user_id', uid);
  if (error) throw error;
  return (data || []).map((r) => r.scholarship_id);
}

// 4. APPLICATIONS
export async function createApplicationRecord(
  uid: string,
  applicationData: Omit<ApplicationHistoryRecord, 'userId' | 'createdAt' | 'updatedAt'>,
): Promise<ApplicationHistoryRecord> {
  if (!uid) throw new Error('Authenticated UID is required to create an application record.');
  const validation = validateApplication(applicationData);
  if (!validation.isValid) throw new Error(`Application validation failed: ${Object.values(validation.errors).join(' ')}`);
  const appId = applicationData.id || `app-${Date.now()}`;
  const now = new Date().toISOString();
  const record: ApplicationHistoryRecord = {
    ...applicationData,
    id: appId,
    userId: uid,
    createdAt: now,
    updatedAt: now,
    documentsSubmitted: applicationData.documentsSubmitted || [],
  };
  const { error } = await supabase.from('applications').upsert({ user_id: uid, id: appId, data: j(record) });
  if (error) throw error;
  return record;
}

export async function updateApplicationStatusRecord(
  uid: string,
  applicationId: string,
  status: ApplicationHistoryRecord['status'],
  notes?: string,
): Promise<void> {
  if (!uid || !applicationId) throw new Error('UID and applicationId are required to update application status.');
  const { data: row, error: readErr } = await supabase
    .from('applications')
    .select('data')
    .eq('user_id', uid)
    .eq('id', applicationId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!row) throw new Error('Application not found');
  const updates: Record<string, unknown> = { status, updatedAt: new Date().toISOString() };
  if (notes !== undefined) updates.notes = notes;
  if (status === 'Applied') updates.appliedDate = new Date().toISOString().split('T')[0];
  const { error } = await supabase
    .from('applications')
    .update({ data: j({ ...(row.data as object), ...updates }), updated_at: new Date().toISOString() })
    .eq('user_id', uid)
    .eq('id', applicationId);
  if (error) throw error;
}

export async function readApplicationHistory(uid: string): Promise<ApplicationHistoryRecord[]> {
  if (!uid) return [];
  const { data, error } = await supabase.from('applications').select('data').eq('user_id', uid);
  if (error) throw error;
  return (data || []).map((r) => r.data as unknown as ApplicationHistoryRecord);
}

export async function deleteApplicationRecord(uid: string, applicationId: string): Promise<void> {
  if (!uid || !applicationId) throw new Error('UID and applicationId are required to delete.');
  const { error } = await supabase.from('applications').delete().eq('user_id', uid).eq('id', applicationId);
  if (error) throw error;
}

// 5. DOCUMENT METADATA
export async function saveDocumentMetadata(
  uid: string,
  docData: Omit<DocumentMetadataRecord, 'userId' | 'createdAt' | 'updatedAt'>,
): Promise<DocumentMetadataRecord> {
  if (!uid) throw new Error('Authenticated UID is required to save document metadata.');
  if (!docData.name || !docData.category) throw new Error('Document name and category are required.');
  const docId = docData.id || `doc-${Date.now()}`;
  const now = new Date().toISOString();
  const record: DocumentMetadataRecord = { ...docData, id: docId, userId: uid, createdAt: now, updatedAt: now };
  const { error } = await supabase.from('documents').upsert({ user_id: uid, id: docId, data: j(record) });
  if (error) throw error;
  return record;
}

export async function readDocumentMetadataList(uid: string): Promise<DocumentMetadataRecord[]> {
  if (!uid) return [];
  const { data, error } = await supabase.from('documents').select('data').eq('user_id', uid);
  if (error) throw error;
  return (data || []).map((r) => r.data as unknown as DocumentMetadataRecord);
}

export async function deleteDocumentMetadata(uid: string, documentId: string): Promise<void> {
  if (!uid || !documentId) throw new Error('UID and documentId are required to delete.');
  const { error } = await supabase.from('documents').delete().eq('user_id', uid).eq('id', documentId);
  if (error) throw error;
}

// 6. TRUSTGUARD REPORTS
export async function submitTrustReport(reportData: Omit<ReportRecord, 'id' | 'reportedAt'>): Promise<ReportRecord> {
  if (!reportData.scholarshipId || !reportData.reason) throw new Error('Scholarship ID and report reason are required.');
  const record: ReportRecord = { ...reportData, id: `rep-${Date.now()}`, reportedAt: new Date().toISOString() };
  const { data: s } = await supabase.auth.getSession();
  const { error } = await supabase.from('reports').insert({
    id: record.id,
    scholarship_id: record.scholarshipId,
    reason: record.reason,
    reported_by: s.session?.user.id ?? null,
    data: j(record),
  });
  if (error) throw error;
  return record;
}
