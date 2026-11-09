import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const INTENDED_SUPABASE_URL = "https://tvesueyreuvjtllukceu.supabase.co";

function resolveSupabaseUrl(): string {
  const envUrl =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
    (typeof process !== "undefined"
      ? process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL
      : undefined);

  if (
    !envUrl ||
    envUrl.includes("wwwyxhlkunsvpqlrrlrn") ||
    envUrl.includes("grantly-demo") ||
    envUrl.includes("your-project")
  ) {
    return INTENDED_SUPABASE_URL;
  }
  return envUrl;
}

export const SUPABASE_URL = resolveSupabaseUrl();

function resolveSupabasePublishableKey(): string {
  const envKey =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
    (typeof process !== "undefined"
      ? process.env?.VITE_SUPABASE_PUBLISHABLE_KEY || process.env?.SUPABASE_PUBLISHABLE_KEY
      : undefined);

  // If the env key belongs to the old orphan project (gaYlUNjkpslICqXoObc00Q_mEQ4S1XO), discard it
  if (envKey && !envKey.includes("gaYlUNjkpslICqXoObc00Q_mEQ4S1XO")) {
    return envKey;
  }
  return "sb_publishable_grantly_client_key";
}

export const SUPABASE_PUBLISHABLE_KEY = resolveSupabasePublishableKey();

// Strict singleton pattern across entire app
let _supabaseInstance: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!_supabaseInstance) {
    _supabaseInstance = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    });
  }
  return _supabaseInstance;
}

/**
 * Standard Supabase client proxy for Grantly AI
 * Guarantees a single persistent client instance across the application.
 */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop, receiver) {
    const client = getSupabaseClient();
    return Reflect.get(client, prop, receiver);
  },
});

export default supabase;
