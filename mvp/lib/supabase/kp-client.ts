"use client";

// Utype Supabase-klient for KostPlan-tabeller (kp_*).
// Disse er ikke i den genererte Database-typen ennå, så vi bruker
// en utype klient for å unngå TypeScript-feil under bygging.
import { createBrowserClient } from "@supabase/ssr";

export function createKpClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
