# Grantly AI — AI-Powered Scholarship Discovery & Application Platform

Grantly AI is an intelligent scholarship discovery, eligibility checking, and application assistance platform designed specifically for students pursuing higher education.

## Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS, TanStack Router, TanStack Query, Radix UI & Lucide Icons.
- **Backend**: Supabase (PostgreSQL with Row Level Security, Supabase Auth, Supabase Storage).
- **AI Engine**: Google Gemini API (`gemini-3.8-flash`) through secure server-side integration (`@google/genai`) for conversational scholarship advice and intelligent optical document readiness checks.
- **Deployment**: Vercel & Node.js compatible.

## Core Features

1. **Authentication & Role-Based Access Control**:
   - Supabase Auth (Email/Password, OAuth, Password Reset, Verification).
   - Role-based permissions (`admin` and `student` roles supported via database RLS).

2. **Personalized Scholarship Discovery**:
   - Central Schemes (NSP, AICTE Pragati, Post-Matric).
   - State Schemes (Jharkhand e-Kalyan, UP Post-Matric, etc.).
   - Category filtering (SC, ST, OBC, Minority, General, EWS, Girl Child, First Generation).
   - Real-time search, bookmarks, verified status badges.

3. **Multi-Factor AI Eligibility Engine**:
   - Evaluates academic merit, family income, domicile, category, and study level against live scheme criteria.
   - Outputs: *Eligible*, *Potentially Eligible*, and *Not Eligible* with step-by-step reasoning.
   - Identifies exact missing documents required for a complete submission.

4. **Document Intelligence**:
   - Secure private file uploads in Supabase Storage.
   - Optical extraction and legibility verification via Gemini 3.8 Flash.
   - Automatic readiness score (0–100) and expiry date warnings.

5. **Grantly Copilot**:
   - Multilingual conversational scholarship advisor (English and Hindi).
   - Grounded directly in verified catalog data to prevent scheme hallucinations.

6. **TrustGuard**:
   - Community-powered reporting for suspicious schemes and portals.

## Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```env
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"
GEMINI_API_KEY="your-gemini-api-key"
```

## Getting Started

```sh
npm install
npm run dev
```

Build for production:
```sh
npm run build
```
