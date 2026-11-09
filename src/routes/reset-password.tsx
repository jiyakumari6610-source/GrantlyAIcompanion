import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "@/lib/router-compat";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
    error_description: typeof search.error_description === "string" ? search.error_description : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Choose a new password — Grantly AI" },
      { name: "description", content: "Set a new password for your Grantly AI account." },
      { property: "og:title", content: "Choose a new password — Grantly AI" },
      { property: "og:description", content: "Set a new password for your Grantly AI account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[ResetPassword] Auth state change:", event);
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => data.session && setReady(true));
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("Password must be at least 6 characters long.");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) return setError(err.message);
    setDone(true);
    setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
  };

  return (
    <div className="min-h-screen bg-[#080D1B] flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-panel rounded-3xl p-8">
        <div className="flex items-center gap-2 mb-6">
          <KeyRound className="w-5 h-5 text-[#42D9F5]" />
          <h1 className="text-xl font-bold text-white">Choose a new password</h1>
        </div>
        {!ready ? (
          <p className="text-sm text-slate-400">
            Open this page from the password reset link in your email.{" "}
            <Link to="/login" className="text-[#8065FF] hover:underline font-semibold">Back to sign in</Link>
          </p>
        ) : done ? (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Password updated. Taking you to your dashboard…
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}
            <input
              type="password"
              required
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#0D1424] border border-white/10 text-sm text-white focus:outline-none focus:border-[#8065FF]"
            />
            <input
              type="password"
              required
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#0D1424] border border-white/10 text-sm text-white focus:outline-none focus:border-[#8065FF]"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#8065FF] to-[#42D9F5] text-white font-semibold text-sm disabled:opacity-60"
            >
              {loading ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
