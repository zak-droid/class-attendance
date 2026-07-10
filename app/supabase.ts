import { createClient } from "@supabase/supabase-js";

// The publishable key is intentionally safe for browser applications. Database
// access is enforced by Supabase Auth and row-level security, never by this key.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  || "https://yjztwkabtooxxedrqmrq.supabase.co";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  || "sb_publishable_nk_U2ZoSiQ-oRvg5sVlsFA_OLPLh-cj";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
