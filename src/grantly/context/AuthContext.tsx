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

/** Account shape the migrated pages expect (mirrors the fields they used). */
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
    } catch (err) {
      console.error("Failed to load user profile:", err);
      setProfile({
        ...BLANK_STUDENT_PROFILE,
        id: appUser.uid,
        fullName: appUser.displayName || "",
        email: appUser.email || "",
      });
    }
    const { data: admin } = await supabase.rpc("has_role", {
      _user_id: appUser.uid,
      _role: "admin",
    });
    setIsAdmin(Boolean(admin));
  };

  useEffect(() => {
    testFirestoreConnection().then(setIsFirestoreOnline);
    let lastUid: string | null = null;

    const handle = (cloudUser: CloudUser | null) => {
      if (!cloudUser) {
        lastUid = null;
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const appUser = toAppUser(cloudUser);
      setUser(appUser);
      if (lastUid !== appUser.uid) {
        lastUid = appUser.uid;
        // Defer data calls out of the auth callback
        setTimeout(() => {
          loadUserProfile(appUser).finally(() => setLoading(false));
        }, 0);
      } else {
        setLoading(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      handle(session?.user ?? null),
    );
    supabase.auth.getSession().then(({ data }) => handle(data.session?.user ?? null));
    return () => sub.subscription.unsubscribe();
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
    await logoutUser();
    setUser(null);
    setProfile(null);
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
