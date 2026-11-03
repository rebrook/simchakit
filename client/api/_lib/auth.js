// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — api/_lib/auth.js
// Shared caller check for API handlers. Validates the Supabase access token from the
// Authorization: Bearer header. Identity comes ONLY from the token, never from the request body.
// Returns { user, supabase } (supabase is a service-role client) or null when the caller is not
// signed in; handlers answer 401 on null.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

export async function authenticate(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return null;

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return { user: data.user, supabase };
}
