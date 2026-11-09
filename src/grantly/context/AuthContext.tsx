import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { User as CloudUser } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchUserProfile,
  persistUserProfile,
  logoutUser,
  resendVerification,
  testFirestoreConnection,
} from "../services/firebase";
import { StudentProfile } from "../types";
import { BLANK_STUDENT_PROFILE } from "../services/storageService";

/** Account shape the migrated pages expect */
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  getIdToken: () => Promise<string>;
}

function toAppUser(u: CloudUser): AppUser {
  const meta = (u.user_metadata || {}) as Record<string, string | undefined>;
  return {
    uid: u.id,
    email: u.email ?? null,
    displayName: meta.full_name || meta.name || null,
    emailVerified: Boolean(u.email_confirmed_at),
    getIdToken: async () => (await supabase.auth.getSession()).data.session?.access_token || "",
  };
}

interface AuthContextType {
  user: AppUser | null;
  profile: StudentProfile | null;
  loading: boolean;
  isFirestoreOnline: boolean;
  emailVerified: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  updateProfileData: (updates: Partial<StudentProfile>) => Promise<void>;
  logout: () => Promise<void>;
  resendEmailVerification: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

// Keep one context instance across hot reloads so providers and consumers always match.
const g = globalThis as any;
const AuthContext: React.Context<AuthContextType | undefined> =
  g.__grantlyAuthContext ||
  (g.__grantlyAuthContext = createContext<AuthContextType | undefined>(undefined));

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFirestoreOnline, setIsFirestoreOnline] = useState(true);

  const loadUserProfile = async (appUser: AppUser) => {
    try {
      let userProfile = await fetchUserProfile(appUser.uid);
      if (!userProfile) {
        console.log("[Auth] No existing profile found. Initializing new profile for:", appUser.uid);
        userProfile = {
          ...BLANK_STUDENT_PROFILE,
          id: appUser.uid,
          fullName: appUser.displayName || "",
          email: appUser.email || "",
          onboardingCompleted: false,
        };
        await persistUserProfile(appUser.uid, userProfile);
      }
      setProfile(userProfile);
      console.log("[Auth] Profile loaded successfully for user:", appUser.uid);
    } catch (err: any) {
      console.warn("[Auth] Database profile fetch warning:", err?.message || err);
      setProfile({
        ...BLANK_STUDENT_PROFILE,
        id: appUser.uid,
        fullName: appUser.displayName || "",
        email: appUser.email || "",
      });
    }

    try {
      const { data: admin } = await supabase.rpc("has_role", {
        _user_id: appUser.uid,
        _role: "admin",
      });
      setIsAdmin(Boolean(admin));
    } catch (rpcErr: any) {
      console.warn("[Auth] Role check warning:", rpcErr?.message || rpcErr);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    testFirestoreConnection().then(setIsFirestoreOnline);
    let isMounted = true;
    let lastUid: string | null = null;

    const handleUserChange = async (cloudUser: CloudUser | null) => {
      if (!isMounted) return;

      if (!cloudUser) {
        lastUid = null;
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
        console.log("[Auth] Auth state cleared: No authenticated user.");
        return;
      }

      const appUser = toAppUser(cloudUser);
      setUser(appUser);
      console.log("[Auth] User active:", appUser.uid);

      if (lastUid !== appUser.uid) {
        lastUid = appUser.uid;
        try {
          await loadUserProfile(appUser);
        } finally {
          if (isMounted) setLoading(false);
        }
      } else {
        if (isMounted) setLoading(false);
      }
    };

    // Main initialization sequence
    const initAuth = async () => {
      console.log("[Auth] Initializing session verification...");

      // 1. Check for OAuth code exchange in URL
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const oauthError = urlParams.get("error");
        const oauthErrorDesc = urlParams.get("error_description");

        if (oauthError) {
          console.error("[Auth] OAuth callback error detected:", oauthError, oauthErrorDesc);
          // Clean the error parameters from the URL
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("error");
          cleanUrl.searchParams.delete("error_description");
          cleanUrl.searchParams.delete("error_code");
          window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.hash);
        } else if (code) {
          console.log("[Auth] OAuth authorization code detected in URL. Exchanging code for session...");
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              console.warn("[Auth] PKCE exchangeCodeForSession notice:", error.message);
            } else if (data?.session?.user) {
              console.log("[Auth] PKCE exchange completed successfully for UID:", data.session.user.id);
            }
          } catch (exchangeErr: any) {
            console.warn("[Auth] PKCE exchange attempt note:", exchangeErr?.message || exchangeErr);
          } finally {
            // Remove code from URL so it is not re-processed or stored in history
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete("code");
            cleanUrl.searchParams.delete("state");
            window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.hash);
          }
        }
      }

      // 2. Resolve active session from Supabase client
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn("[Auth] getSession warning:", error.message);
        }
        if (data?.session?.user) {
          console.log("[Auth] Initial active session established for:", data.session.user.id);
          await handleUserChange(data.session.user);
        } else {
          console.log("[Auth] Initial check: No active session present.");
          await handleUserChange(null);
        }
      } catch (err: any) {
        console.warn("[Auth] Session recovery error:", err?.message || err);
        await handleUserChange(null);
      }
    };

    // Register auth state change listener
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Auth] Auth state change event received:", event);
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
        if (session?.user) {
          await handleUserChange(session.user);
        }
      } else if (event === "SIGNED_OUT") {
        await handleUserChange(null);
      }
    });

    // Listen for cross-window message from OAuth popup window
    const handleWindowMessage = async (event: MessageEvent) => {
      if (event.data?.type === "GRANTLY_OAUTH_SUCCESS") {
        console.log("[Auth] Cross-window GRANTLY_OAUTH_SUCCESS received.");
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          await handleUserChange(data.session.user);
        }
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("message", handleWindowMessage);
    }

    initAuth();

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("message", handleWindowMessage);
      }
    };
  }, []);

  const refreshProfile = async () => {
    if (user) await loadUserProfile(user);
  };

  const updateProfileData = async (updates: Partial<StudentProfile>) => {
    if (!user || !profile) return;
    const merged: StudentProfile = {
      ...profile,
      ...updates,
      id: user.uid,
      email: user.email || profile.email,
    };
    setProfile(merged);
    await persistUserProfile(user.uid, merged);
  };

  const logout = async () => {
    console.log("[Auth] User triggered logout.");
    await logoutUser();
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isFirestoreOnline,
        emailVerified: user?.emailVerified || false,
        isAdmin,
        refreshProfile,
        updateProfileData,
        logout,
        resendEmailVerification: resendVerification,
        getIdToken: async () => (user ? user.getIdToken() : null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
