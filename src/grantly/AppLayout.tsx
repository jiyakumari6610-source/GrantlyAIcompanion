import React, { useState } from "react";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Navigate } from "@/lib/router-compat";
import { useAuth } from "./context/AuthContext";
import { Loader2 } from "lucide-react";

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#080D1B] text-slate-100 flex flex-col">
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 relative">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 lg:pl-64 px-4 sm:px-6 lg:px-8 py-6 w-full max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
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
            : "Checking Session..."}
        </div>
      </div>
    );
  }

  if (user) {
    console.log("[GuestRoute] Authenticated user detected on guest route, redirecting to /dashboard");
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const ProtectedApp: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);
