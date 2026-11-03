// Headers for our own /api calls that act as the signed-in user. The server reads the caller's identity
// from this token only (never from the request body), so every such call must send it.
import { supabase } from "@/lib/supabase.js";

export async function authJsonHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
