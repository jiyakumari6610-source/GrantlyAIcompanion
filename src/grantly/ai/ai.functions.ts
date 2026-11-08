import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GoogleGenAI } from "@google/genai";
import { DEMO_SCHOLARSHIPS } from "../data/scholarships";

const MODEL_NAME = "gemini-3.8-flash";
const SUPPORTED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Initialize the server-side Gemini client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// ==========================================
// Grantly Copilot chat (English & Hindi)
// ==========================================
type ChatInput = {
  message: string;
  history?: { role: string; text: string }[];
  studentProfile?: Record<string, any> | null;
  currentScholarship?: Record<string, any> | null;
};

export const copilotChatFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ChatInput) => {
    if (!input || typeof input.message !== "string" || !input.message.trim())
      throw new Error("Message is required");
    if (input.message.length > 4000) throw new Error("Message is too long");
    return input;
  })
  .handler(async ({ data, context }) => {
    let rawRows: any[] = [];
    try {
      const { data: catRows } = await context.supabase.from("scholarships").select("data").limit(50);
      if (catRows && catRows.length > 0) rawRows = catRows.map((r: any) => r.data || {});
    } catch {
      rawRows = [];
    }
    const catalogList = rawRows.length > 0 ? rawRows : DEMO_SCHOLARSHIPS;
    const catalog = catalogList
      .map(
        (c: any) =>
          `- [${c.verificationStatus || "UNVERIFIED"}] ${c.name} | Provider: ${c.provider} | Award: ₹${c.awardAmount} | Deadline: ${c.deadline || "not listed"} | Min marks: ${c.minMarks ?? "n/a"}% | Max income: ₹${c.maxIncome ?? "n/a"} | Categories: ${(c.categories || []).join("/")} | States: ${(c.eligibleStates || []).join("/")} | Docs: ${(c.requiredDocuments || []).join("; ")} | Official link: ${c.officialSourceUrl || "not listed"} | Last checked: ${c.lastCheckedAt || "n/a"}`,
      )
      .join("\n");
    const p = data.studentProfile;
    const studentContext = p
      ? `Student Profile Context:
- Name: ${p.fullName || "Student"}
- Academic: ${p.course || "Degree"} at ${p.college || "College"}, Year ${p.academicYear || 1}, Marks: ${p.percentage || "N/A"}%
- Domicile: ${p.state || "India"}, ${p.city || ""}
- Family Annual Income: ₹${p.annualFamilyIncome ? Number(p.annualFamilyIncome).toLocaleString("en-IN") : "N/A"}
- Category: ${p.category || "General"}
- First Generation Learner: ${p.isFirstGen ? "Yes" : "No"}`
      : "No student profile context provided.";
    const s = data.currentScholarship;
    const scholarshipContext = s
      ? `Focused Scholarship Context:
- Name: ${s.name}
- Provider: ${s.provider}
- Award: ₹${Number(s.awardAmount).toLocaleString("en-IN")}
- Eligibility: Min Marks ${s.minMarks}%, Max Income ₹${Number(s.maxIncome).toLocaleString("en-IN")}
- Required Documents: ${(s.requiredDocuments || []).join(", ")}
- Deadline: ${s.deadline}`
      : "";

    const systemInstruction = `You are "Grantly Copilot", an elite, empathetic, and knowledgeable scholarship advisor for GRANTLY AI ("Your Future Deserves Funding").
You help Indian and international students discover scholarships, understand intricate eligibility criteria, navigate document requirements, compute funding gaps, and craft winning applications.

Key Guidelines:
1. Support both English and Hindi (Hinglish or Devanagari Hindi if the user asks in Hindi).
2. Ground all answers in realistic scholarship logic. Always remind students to verify with the official portal when appropriate.
3. Be transparent. Never invent fake active government schemes or guarantee awards.
4. If asked "Which scholarships am I eligible for?", reference their profile marks and income explicitly.
5. If asked about required documents, break them down clearly: Marksheet, Income Certificate, Domicile/Bonafide, Caste Certificate (if applicable), Aadhaar.
6. Keep formatting neat with concise bullet points, bold key terms, and actionable next steps.
7. Only state deadlines, eligibility rules, amounts and official links that appear in the GRANTLY CATALOG below. Never invent them. If something isn't in the catalog, say you don't have verified details and suggest checking the official portal.
8. Structure answers with two clearly labelled sections when relevant: "✅ Verified (from Grantly catalog)" for catalog facts (mention the last-checked date), and "💡 General guidance" for general advice.
9. Reply in the language the student writes in (simple English or simple Hindi).

GRANTLY CATALOG:
${catalog || "(catalog unavailable)"}

${studentContext}
${scholarshipContext}`;

    const ai = getGeminiClient();
    if (!ai) {
      return {
        reply: `Hello! I am Grantly Copilot. Currently, the server Gemini API key is being initialized. In the meantime, I can confirm that your catalog has ${catalogList.length} scholarship opportunities loaded (including Post-Matric, AICTE Pragati, and e-Kalyan schemes). Please ensure GEMINI_API_KEY is configured in your server secrets.`,
        source: "system-fallback",
      };
    }

    try {
      const contents: any[] = [];
      const safeHistory = (data.history || []).slice(-6);
      for (const m of safeHistory) {
        contents.push({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: String(m.text || "").slice(0, 4000) }],
        });
      }
      contents.push({
        role: "user",
        parts: [{ text: data.message }],
      });

      const res = await ai.models.generateContent({
        model: MODEL_NAME,
        contents,
        config: {
          systemInstruction,
        },
      });

      const reply =
        res.text?.trim() ||
        "I'm ready to assist with your scholarship search and application steps.";
      return { reply, source: MODEL_NAME };
    } catch (err: any) {
      console.error("Copilot AI error:", err);
      const msg = String(err?.message || "");
      if (/API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)) {
        throw new Error("AI service authentication failed. Please check the server GEMINI_API_KEY.");
      }
      if (/RESOURCE_EXHAUSTED|rate/i.test(msg)) {
        throw new Error("Copilot is currently receiving high traffic. Please wait a minute and try again.");
      }
      throw new Error("Copilot could not answer right now. Please try again.");
    }
  });

// ==========================================
// Document Intelligence analysis
// ==========================================
type AnalyzeInput = {
  documentId: string;
  fileName?: string;
  documentType?: string;
  mimeType?: string;
  base64Data?: string;
};

export const analyzeDocumentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AnalyzeInput) => {
    if (!input || typeof input.documentId !== "string" || !input.documentId)
      throw new Error("Document ID required.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const docId = data.documentId;

    const { data: row } = await supabase
      .from("documents")
      .select("data, storage_path")
      .eq("user_id", userId)
      .eq("id", docId)
      .maybeSingle();
    if (!row) throw new Error("Document not found or access denied.");
    const existing = (row.data || {}) as Record<string, any>;

    const effectiveCategory =
      data.documentType || existing.documentType || existing.category || "Marksheet";
    const effectiveFileName = data.fileName || existing.name || existing.fileName || "document";
    const effectiveMime = (
      data.mimeType ||
      existing.mimeType ||
      existing.fileType ||
      "application/pdf"
    ).toLowerCase();
    if (!SUPPORTED_MIME_TYPES.includes(effectiveMime)) {
      throw new Error(
        `Invalid file type '${effectiveMime}'. Supported formats are PDF, JPG, and PNG.`,
      );
    }

    let cleanBase64 = data.base64Data
      ? data.base64Data.replace(/^data:[a-zA-Z0-9/+.-]+;base64,/, "")
      : "";
    if (!cleanBase64 && row.storage_path) {
      const { data: blob, error } = await supabase.storage
        .from("documents")
        .download(row.storage_path);
      if (error || !blob) throw new Error("Stored document file could not be read.");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000)
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      cleanBase64 = btoa(bin);
    }
    if (!cleanBase64) throw new Error("No document data found for analysis.");
    if (Math.ceil((cleanBase64.length * 3) / 4) > MAX_FILE_SIZE_BYTES)
      throw new Error("File size exceeds maximum 10MB limit.");

    const { data: profRow } = await supabase
      .from("profiles")
      .select("data")
      .eq("id", userId)
      .maybeSingle();
    const profileData = (profRow?.data || null) as Record<string, any> | null;

    const systemInstruction = `You are Grantly AI's Document Intelligence Extraction Engine.
Analyze this uploaded scholarship document (category: "${effectiveCategory}", file: "${effectiveFileName}").

CRITICAL EXTRACTION DIRECTIVES:
1. Extract ONLY information that is clearly and explicitly legible in this document.
2. DO NOT invent, assume, or guess missing values.
3. If a field cannot be clearly read or is absent, return null or empty array.
4. Check if the document appears blurry, cut off, or illegible.
5. If an expiry date is visible, note it accurately.
6. AI analysis is an automated readiness inspection. It does NOT constitute official government certification.

Respond with ONLY a JSON object with these fields:
documentType (string), studentName (string|null), institutionName (string|null), academicYear (string|null),
marksOrPercentage (string|null), issuingAuthority (string|null), issueDate (string|null), expiryDate (string|null),
relevantDetails (string|null), isLegible (boolean), readabilityNotes (string), confidenceScore (integer 0-100),
missingMandatoryFields (string[]), detectedInconsistencies (string[]),
summaryEnglish (string: 2-3 simple sentences explaining what this document is and what it shows),
summaryHindi (string: the same explanation in simple Devanagari Hindi),
eligibilityNotes (string[]: how these details may relate to common Indian scholarship criteria such as income limits, category, domicile or marks; never claim official verification).
Student profile for context (may be empty): ${JSON.stringify(profileData ? { fullName: profileData.fullName, category: profileData.category, state: profileData.state, annualIncome: profileData.annualIncome, percentage: profileData.percentage } : {})}`;

    const markFailed = async (msg: string) => {
      await supabase
        .from("documents")
        .update({
          data: {
            ...existing,
            analysisStatus: "ANALYSIS_FAILED",
            manualVerificationRequired: true,
            inconsistencies: [msg],
            updatedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("id", docId);
    };

    const ai = getGeminiClient();
    if (!ai) {
      await markFailed("Server Gemini API key is not configured.");
      throw new Error(
        "AI is not configured for this project right now, so no analysis was produced. Your file is still safely stored in Supabase.",
      );
    }

    let raw = "";
    try {
      const filePart = {
        inlineData: {
          mimeType: effectiveMime,
          data: cleanBase64,
        },
      };
      const textPart = {
        text: "Examine this uploaded certificate/document and return the structured JSON object.",
      };

      const res = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [filePart, textPart],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
        },
      });

      raw = res.text?.trim() || "{}";
    } catch (err: any) {
      console.error("Document analysis AI error:", err);
      await markFailed("AI analysis error: processing failed");
      const msg = String(err?.message || "");
      if (/API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)) {
        throw new Error(
          "AI authentication failed. Your file is safely stored, but optical analysis could not run.",
        );
      }
      if (/RESOURCE_EXHAUSTED|rate/i.test(msg)) {
        throw new Error("AI service is busy right now. Please try analysis again in a moment.");
      }
      throw new Error("Document analysis failed. The AI could not process the provided file.");
    }

    let extracted: any = {};
    try {
      extracted = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) {
        await markFailed("Model did not return valid JSON");
        throw new Error("Model did not return valid JSON");
      }
      extracted = JSON.parse(m[0]);
    }

    const isLegible = Boolean(extracted.isLegible);
    const confidenceScore = Math.max(0, Math.min(100, Number(extracted.confidenceScore) || 50));
    const missingInfo: string[] = Array.isArray(extracted.missingMandatoryFields)
      ? extracted.missingMandatoryFields.filter(Boolean)
      : [];
    const inconsistencies: string[] = Array.isArray(extracted.detectedInconsistencies)
      ? extracted.detectedInconsistencies.filter(Boolean)
      : [];

    let expiryWarning: string | null = null;
    if (extracted.expiryDate && typeof extracted.expiryDate === "string") {
      const exp = new Date(extracted.expiryDate);
      if (!isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        expiryWarning = `Certificate expired on ${extracted.expiryDate}. Government portals require an active, valid certificate.`;
      }
    }

    if (profileData && extracted.studentName && profileData.fullName) {
      const a = String(extracted.studentName)
        .toLowerCase()
        .replace(/[^a-z]/g, "");
      const b = String(profileData.fullName)
        .toLowerCase()
        .replace(/[^a-z]/g, "");
      if (a && b && !a.includes(b) && !b.includes(a)) {
        inconsistencies.push(
          `Extracted name "${extracted.studentName}" differs from registered profile name "${profileData.fullName}".`,
        );
      }
    }

    let analysisStatus: "ANALYZED" | "NEEDS_REVIEW" | "UNREADABLE" = "ANALYZED";
    if (!isLegible || confidenceScore < 40) analysisStatus = "UNREADABLE";
    else if (missingInfo.length || inconsistencies.length || expiryWarning || confidenceScore < 70)
      analysisStatus = "NEEDS_REVIEW";

    const readinessScore =
      analysisStatus === "UNREADABLE"
        ? 30
        : analysisStatus === "NEEDS_REVIEW"
          ? Math.min(78, Math.max(50, confidenceScore - 15))
          : Math.min(98, Math.max(82, confidenceScore));
    const confidenceTier: "HIGH" | "MEDIUM" | "LOW" =
      confidenceScore >= 80 ? "HIGH" : confidenceScore >= 50 ? "MEDIUM" : "LOW";

    const extractedData = {
      documentType: extracted.documentType || effectiveCategory,
      studentName: extracted.studentName || null,
      institutionName: extracted.institutionName || null,
      academicYear: extracted.academicYear || null,
      marksOrPercentage: extracted.marksOrPercentage || null,
      issuingAuthority: extracted.issuingAuthority || null,
      issueDate: extracted.issueDate || null,
      expiryDate: extracted.expiryDate || null,
      relevantDetails: extracted.relevantDetails || null,
      isLegible,
      readabilityNotes:
        extracted.readabilityNotes ||
        (isLegible ? "Document text clearly readable." : "Low clarity scan."),
      confidenceScore,
      confidenceTier,
      summaryEnglish:
        typeof extracted.summaryEnglish === "string" ? extracted.summaryEnglish : null,
      summaryHindi: typeof extracted.summaryHindi === "string" ? extracted.summaryHindi : null,
      eligibilityNotes: Array.isArray(extracted.eligibilityNotes)
        ? extracted.eligibilityNotes.filter(Boolean).map(String)
        : [],
    };

    const now = new Date().toISOString();
    const document = {
      ...existing,
      id: docId,
      documentId: docId,
      ownerUid: userId,
      userId,
      documentType: effectiveCategory,
      mimeType: effectiveMime,
      analysisStatus,
      readinessScore,
      extractedData,
      missingInformation: missingInfo,
      inconsistencies,
      expiryWarning,
      manualVerificationRequired: true,
      analyzedAt: now,
      updatedAt: now,
    };
    await supabase
      .from("documents")
      .update({ data: document, updated_at: now })
      .eq("user_id", userId)
      .eq("id", docId);

    return {
      success: true,
      analysisStatus,
      document,
      extractedData,
      missingInformation: missingInfo,
      inconsistencies,
      expiryWarning,
      manualVerificationRequired: true,
      disclaimer:
        "AI Document Intelligence provides automated optical extraction and consistency audits. Grantly AI does not issue or represent official government legal verifications.",
    };
  });
