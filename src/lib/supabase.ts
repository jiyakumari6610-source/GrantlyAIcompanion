import { supabase } from "@/integrations/supabase/client";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";

export { supabase };

/**
 * Grantly AI Authentication Service
 * Wraps the unified Supabase client with typed helpers, safe diagnostics, and error mapping.
 */
export const authService = {
  /**
   * Register a new user with email and password
   */
  async signUp(email: string, password: string, fullName: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${origin}/onboarding`,
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (error) throw error;
    return data;
  },

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Sign in with Google OAuth using PKCE redirect
   */
  async signInWithGoogle(redirectTo?: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const redirectUrl = redirectTo || `${origin}/dashboard`;
    console.log("[Auth] Initiating Google OAuth sign-in, redirect URL target:", redirectUrl);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      console.error("[Auth] Google OAuth sign-in error:", error.message);
      throw error;
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
          return { ...data, popupBlocked: true };
        }
        return { ...data, popupBlocked: false };
      } else {
        console.log("[Auth] Standard tab detected. Navigating directly to OAuth URL...");
        window.location.href = data.url;
      }
    }
    return data;
  },

  /**
   * Complete PKCE code exchange manually if needed
   */
  async exchangeCodeForSession(code: string) {
    console.log("[Auth] Manually exchanging OAuth code for session...");
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[Auth] Code exchange error:", error.message);
      throw error;
    }
    console.log("[Auth] Code exchange completed successfully.");
    return data;
  },

  /**
   * Sign out current user
   */
  async signOut() {
    console.log("[Auth] Signing out user...");
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Send password reset email
   */
  async resetPassword(email: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/reset-password`,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Update password for an authenticated session
   */
  async updatePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Resend signup verification email
   */
  async resendVerificationEmail(email: string) {
    const { data, error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
    });

    if (error) throw error;
    return data;
  },

  /**
   * Get active session
   */
  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /**
   * Get current authenticated user
   */
  async getUser(): Promise<User | null> {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

export default supabase;
