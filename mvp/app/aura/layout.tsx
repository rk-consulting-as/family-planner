import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuraTopBar from "@/components/aura/AuraTopBar";
import AuraBottomNav from "@/components/aura/AuraBottomNav";
import "./aura.css";

export default async function AuraLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Hent grunninfo om Aura-profilen (lazy: opprett ved første besøk)
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, color_hex")
    .eq("id", user.id)
    .single();
  type P = { display_name: string; avatar_url: string | null; color_hex: string | null };
  const p = (profile || {
    display_name: "Du",
    avatar_url: null,
    color_hex: null,
  }) as P;

  // Sørg for at det finnes en aura_profile-rad
  const { data: auraProfile } = await supabase
    .from("aura_profiles")
    .select("profile_id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!auraProfile) {
    await supabase.from("aura_profiles").insert({ profile_id: user.id });
  }

  // Tell uleste activities
  const { count: unreadCount } = await supabase
    .from("aura_activities")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  return (
    <div className="aura-scope">
      <AuraTopBar
        displayName={p.display_name}
        avatarUrl={p.avatar_url}
        colorHex={p.color_hex}
        unreadCount={unreadCount || 0}
      />
      <main className="max-w-2xl mx-auto px-4 pb-24">{children}</main>
      <AuraBottomNav />
    </div>
  );
}
