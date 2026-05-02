// SERVER-ONLY service role client.
// Aldri importér denne fra "use client"-filer eller fra app/-rotsider som
// rendres på klient. Brukes utelukkende fra server actions / route handlers
// for handlinger som krever bypass av RLS (typisk: opprette nye auth-brukere).

import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY mangler. Legg den inn i .env.local (lokal) og Vercel env vars (produksjon)."
    );
  }
  return createServiceClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
