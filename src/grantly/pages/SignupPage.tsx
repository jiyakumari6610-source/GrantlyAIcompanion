import React, { useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import {
  GraduationCap,
  ArrowRight,
  Lock,
  Mail,
  User,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { registerWithEmail, loginWithGoogle } from "../services/firebase";
import { useAuth } from "../context/AuthContext";

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [popupBlockedUrl, setPopupBlockedUrl] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  React.useEffect(() => {
    if (!authLoading && user) {
      console.log("[SignupPage] Authenticated user detected. Redirecting to /onboarding");
      navigate("/onboarding", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      const { needsConfirmation } = await registerWithEmail(email, password, fullName);
      setVerificationSent(true);
      if (!needsConfirmation) {
        setTimeout(() => {
          navigate("/onboarding");
        }, 1200);
      }
    } catch (err: any) {
      console.error("Signup error:", err);
      let message = "Failed to create student account. Please try again.";
      if (err.code === "auth/email-already-in-use") {
        message = "This email is already registered. Please sign in instead.";
      } else if (err.code === "auth/weak-password") {
        message = "The password is too weak. Please use at least 6 characters.";
      } else if (err.code === "auth/invalid-email") {
        message = "Please provide a valid student email address.";
      }
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  // Check URL query and hash parameters for any OAuth errors returned from the auth provider
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    const hashStr = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hashStr);

    const errorDesc =
      searchParams.get("error_description") ||
      hashParams.get("error_description") ||
      searchParams.get("error") ||
      hashParams.get("error");

    if (errorDesc) {
      const decoded = decodeURIComponent(errorDesc.replace(/\+/g, " "));
      console.error("[SignupPage] OAuth error from URL parameter:", decoded);
      if (
        decoded.toLowerCase().includes("missing oauth secret") ||
        decoded.toLowerCase().includes("unsupported provider")
      ) {
        setErrorMsg(
          "Google OAuth configuration error: Provider secret is missing or misconfigured in the active Supabase project. Verify OAuth settings in your Supabase Dashboard."
        );
      } else {
        setErrorMsg(decoded);
      }
    }
  }, []);

  const handleGoogleSignup = async () => {
    setErrorMsg(null);
    setPopupBlockedUrl(null);
    setGoogleLoading(true);
    try {
      const result = await loginWithGoogle();
      if (result.popupBlocked && result.authUrl) {
        setPopupBlockedUrl(result.authUrl);
      } else if (!result.redirected && !result.popupBlocked) {
        navigate("/onboarding");
      }
    } catch (err: any) {
      console.error("Google signup error:", err);
      if (err.code !== "auth/popup-closed-by-user") {
        const rawMsg = err.message || "";
        if (
          rawMsg.toLowerCase().includes("missing oauth secret") ||
          rawMsg.toLowerCase().includes("unsupported provider")
        ) {
          setErrorMsg(
            "Google OAuth configuration error: Provider secret is missing or misconfigured in the active Supabase project. Verify OAuth settings in your Supabase Dashboard."
          );
        } else if (
          rawMsg.toLowerCase().includes("403") ||
          rawMsg.toLowerCase().includes("access_denied") ||
          rawMsg.toLowerCase().includes("disallowed_useragent")
        ) {
          setErrorMsg(
            "Google Access Blocked (Error 403): If your Google Cloud OAuth app is in 'Testing' mode, please ensure your email (jiyakumari6610@gmail.com) is added under Google Cloud Console > OAuth consent screen > Test users. Alternatively, open the preview in a separate browser tab."
          );
        } else {
          setErrorMsg(rawMsg || "Google sign-up could not be completed. Please try again.");
        }
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080D1B] flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#42D9F5]/10 blur-3xl pointer-events-none -z-10" />

      <div className="w-full max-w-md glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl relative">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#8065FF] to-[#42D9F5] p-0.5">
              <div className="w-full h-full bg-[#080D1B] rounded-[10px] flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-[#42D9F5]" />
              </div>
            </div>
            <span className="font-heading font-extrabold text-xl text-white">
              GRANTLY<span className="text-[#8065FF]">.AI</span>
            </span>
          </Link>
          <h2 className="font-heading text-xl font-bold text-white">Create Student Account</h2>
          <p className="text-xs text-slate-400 mt-1">
            Unlock AI scholarship discovery tailored to your goals
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Popup Blocked Fallback for Preview iframes */}
        {popupBlockedUrl && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-col gap-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                Browser blocked the authentication popup. Click below to open Google Sign-In directly in a new tab:
              </span>
            </div>
            <a
              href={popupBlockedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-lg text-xs hover:brightness-110 transition-all shadow-md"
            >
              Open Google Sign-In in New Tab <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {verificationSent && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              Account created! Check your inbox and click the verification link to activate your
              account.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Full Legal Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Priya Patel"
                className="w-full bg-[#080D1B] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#8065FF]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="priya.patel@university.edu"
                className="w-full bg-[#080D1B] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#8065FF]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Create Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-[#080D1B] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#8065FF]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#8065FF] to-[#603bfa] hover:brightness-110 text-white font-bold text-xs shadow-lg shadow-[#8065FF]/30 transition flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Continue to Profile Setup"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Google Sign-in */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={googleLoading || loading}
            className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-2.5"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            {googleLoading ? "Connecting Google Account..." : "Sign up with Google"}
          </button>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">
          Already registered?{" "}
          <Link to="/login" className="text-[#8065FF] hover:underline font-semibold">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
