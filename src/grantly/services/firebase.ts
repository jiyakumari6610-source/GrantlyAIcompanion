/**
 * Grantly data + auth service, backed by Supabase.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { StudentProfile, ApplicationRecord, UploadedDocument, SuspiciousReport } from "../types";
import { analyzeDocumentFn } from "../ai/ai.functions";

export const DOCUMENTS_BUCKET = "documents";

function authError(err: { message?: string; code?: string } | null, fallback = "auth/unknown") {
  const e: any = new Error(err?.message || "Authentication failed");
  const msg = (err?.message || "").toLowerCase();
  if (msg.includes("invalid login")) e.code = "auth/invalid-credential";
  else if (msg.includes("email not confirmed")) e.code = "auth/email-not-confirmed";
  else if (msg.includes("already registered")) e.code = "auth/email-already-in-use";
  else if (msg.includes("password")) e.code = "auth/weak-password";
  else if (msg.includes("rate limit")) e.code = "auth/too-many-requests";
  else e.code = err?.code || fallback;
  return e;
}

async function currentUid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function testFirestoreConnection(): Promise<boolean> {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

// ==========================================
// AUTHENTICATION HELPERS
// ==========================================

export async function registerWithEmail(email: string, pass: string, fullName: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password: pass,
    options: {
      emailRedirectTo: `${origin}/onboarding`,
      data: { full_name: fullName.trim() },
    },
  });
  if (error) throw authError(error);
  // Supabase returns a user with no identities when the email already exists
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    throw authError({ message: "User already registered" });
  }
  return { user: data.user, needsConfirmation: !data.session };
}

export async function loginWithEmail(email: string, pass: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: pass,
  });
  if (error) throw authError(error);
  return data.user;
}

export interface GoogleAuthResult {
  redirected: boolean;
  authUrl?: string;
  popupBlocked?: boolean;
}

export async function loginWithGoogle(): Promise<GoogleAuthResult> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  console.log("[Auth] Initiating Google sign-in with redirect target:", `${origin}/dashboard`);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/dashboard`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
      skipBrowserRedirect: true,
    },
  });
  if (error) {
    console.error("[Auth] Google sign-in request error:", error.message);
    throw authError(error);
  }

  if (data?.url && typeof window !== "undefined") {
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
      console.log("[Auth] Preview iframe environment detected. Opening Google OAuth in popup...");
      const width = 500;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        data.url,
        "google_oauth_popup",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        console.warn("[Auth] Popup blocked by browser settings.");
        return { redirected: false, authUrl: data.url, popupBlocked: true };
      }
      return { redirected: true, authUrl: data.url, popupBlocked: false };
    } else {
      console.log("[Auth] Standard tab detected. Navigating directly to OAuth URL...");
      window.location.href = data.url;
      return { redirected: true, authUrl: data.url, popupBlocked: false };
    }
  }

  return { redirected: false };
}

export async function sendPasswordReset(email: string): Promise<void> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${origin}/reset-password`,
  });
  if (error) throw authError(error);
}

export async function resendVerification(): Promise<void> {
  const { data } = await supabase.auth.getUser();
  if (data.user?.email) {
    await supabase.auth.resend({ type: "signup", email: data.user.email });
  }
}

export async function logoutUser(): Promise<void> {
  await supabase.auth.signOut();
}

// ==========================================
// PROFILE
// ==========================================

export async function fetchUserProfile(uid: string): Promise<StudentProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("data")
    .eq("id", uid)
    .maybeSingle();
  if (error) throw error;
  return data ? (data.data as unknown as StudentProfile) : null;
}

export async function persistUserProfile(uid: string, profile: StudentProfile): Promise<void> {
  const clean = { ...profile, id: uid, updatedAt: new Date().toISOString() };
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: uid, data: clean as unknown as Json, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ==========================================
// APPLICATIONS
// ==========================================

export async function fetchUserApplications(uid: string): Promise<ApplicationRecord[]> {
  const { data, error } = await supabase.from("applications").select("data").eq("user_id", uid);
  if (error) throw error;
  return (data || []).map((r) => r.data as unknown as ApplicationRecord);
}

export async function persistUserApplication(
  uid: string,
  application: ApplicationRecord,
): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("applications")
    .select("data")
    .eq("user_id", uid)
    .eq("id", application.id)
    .maybeSingle();
  const merged = {
    ...((existing?.data as object) || {}),
    ...application,
    userId: uid,
    updatedAt: now,
  };
  const { error } = await supabase
    .from("applications")
    .upsert({ user_id: uid, id: application.id, data: merged as unknown as Json, updated_at: now });
  if (error) throw error;
}

export async function deleteUserApplication(uid: string, applicationId: string): Promise<void> {
  const { error } = await supabase
    .from("applications")
    .delete()
    .eq("user_id", uid)
    .eq("id", applicationId);
  if (error) throw error;
}

// ==========================================
// SAVED SCHOLARSHIPS
// ==========================================

export async function fetchUserSavedScholarships(uid: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("saved_scholarships")
    .select("scholarship_id")
    .eq("user_id", uid);
  if (error) throw error;
  return (data || []).map((r) => r.scholarship_id);
}

export async function toggleUserSavedScholarship(
  uid: string,
  scholarshipId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("saved_scholarships")
    .select("scholarship_id")
    .eq("user_id", uid)
    .eq("scholarship_id", scholarshipId)
    .maybeSingle();
  if (data) {
    await supabase
      .from("saved_scholarships")
      .delete()
      .eq("user_id", uid)
      .eq("scholarship_id", scholarshipId);
    return false;
  }
  const { error } = await supabase
    .from("saved_scholarships")
    .insert({ user_id: uid, scholarship_id: scholarshipId });
  if (error) throw error;
  return true;
}

// ==========================================
// DOCUMENTS (metadata in table, file bytes in private storage)
// ==========================================

export async function fetchUserDocuments(uid: string): Promise<UploadedDocument[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("data, storage_path")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({
    ...(r.data as unknown as UploadedDocument),
    storagePath: r.storage_path || undefined,
  }));
}

export async function persistUserDocument(uid: string, docData: UploadedDocument): Promise<void> {
  const clean: UploadedDocument = { ...docData, fileData: undefined };
  const { error } = await supabase.from("documents").upsert({
    user_id: uid,
    id: docData.id,
    storage_path: docData.storagePath ?? null,
    data: { ...clean, userId: uid } as unknown as Json,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function uploadDocumentFileToStorage(
  uid: string,
  docId: string,
  file: File | Blob,
  fileName: string,
): Promise<string> {
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${uid}/${docId}/${cleanName}`;
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(storagePath, file, {
    upsert: true,
    contentType: (file as File).type || undefined,
  });
  if (error) throw error;
  return storagePath;
}

export async function getDocumentFileUrl(storagePath: string, download?: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, 300, download ? { download } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteDocumentFileFromStorage(storagePath: string): Promise<void> {
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
}

export async function deleteUserDocument(
  uid: string,
  documentId: string,
  storagePath?: string,
): Promise<void> {
  if (storagePath) await deleteDocumentFileFromStorage(storagePath);
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("user_id", uid)
    .eq("id", documentId);
  if (error) throw error;
}

export async function analyzeDocumentWithGemini(
  _idToken: string | null,
  payload: {
    documentId: string;
    fileName?: string;
    documentType?: string;
    mimeType?: string;
    base64Data?: string;
    studentProfile?: any;
  },
) {
  return analyzeDocumentFn({
    data: {
      documentId: payload.documentId,
      fileName: payload.fileName,
      documentType: payload.documentType,
      mimeType: payload.mimeType,
      base64Data: payload.base64Data,
    },
  });
}

// ==========================================
// TRUSTGUARD REPORTS
// ==========================================

export async function createTrustGuardReport(report: SuspiciousReport): Promise<void> {
  const uid = await currentUid();
  const { error } = await supabase.from("reports").insert({
    id: report.id,
    scholarship_id: report.scholarshipId,
    reason: report.reason,
    reported_by: uid,
    data: report as unknown as Json,
  });
  if (error) throw error;
}
