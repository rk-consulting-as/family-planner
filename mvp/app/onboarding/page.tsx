import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // If already in a group, send to dashboard
  const { data: existing } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("profile_id", user.id)
    .limit(1);
  if (existing && existing.length > 0) redirect("/dashboard");

  return <OnboardingClient />;
}
