import React from "react";
import { Navigate, useLocation } from "@/lib/router-compat";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireOnboarding = false,
}) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // If running in a popup window opened from the parent app, notify the parent and close
  React.useEffect(() => {
    if (typeof window !== "undefined" && window.opener && window.opener !== window && user) {
      console.log("[ProtectedRoute] Authenticated in popup. Notifying opener and closing window...");
      try {
        window.opener.postMessage({ type: "GRANTLY_OAUTH_SUCCESS" }, "*");
      } catch (err) {
        console.warn("[ProtectedRoute] Error posting message to opener:", err);
      }
      setTimeout(() => {
        try {
          window.close();
        } catch {
          // ignore
        }
      }, 500);
    }
  }, [user]);

  // If the browser URL currently has an OAuth code or hash token, PKCE exchange is in flight
  const isOauthCallbackPending =
    typeof window !== "undefined" &&
    (new URLSearchParams(window.location.search).has("code") ||
      window.location.hash.includes("access_token="));

  if (loading || isOauthCallbackPending) {
    return (
      <div className="min-h-screen bg-[#080D1B] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#8065FF] to-[#42D9F5] p-0.5 animate-pulse mb-4">
          <div className="w-full h-full bg-[#080D1B] rounded-[14px] flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-[#42D9F5] animate-spin" />
          </div>
        </div>
        <div className="text-xs font-semibold tracking-wider uppercase text-slate-400">
          {isOauthCallbackPending
            ? "Completing Google Authentication..."
            : "Verifying Authenticated Session..."}
        </div>
      </div>
    );
  }

  if (!user) {
    console.log("[ProtectedRoute] Access denied: unauthenticated user. Redirecting to /login from:", location.pathname);
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If page requires completed onboarding, check status
  if (requireOnboarding && profile && !profile.onboardingCompleted) {
    console.log("[ProtectedRoute] Onboarding pending for user:", user.uid);
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};
