import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/queries";
import { getCaseEvents, getCaseDocuments } from "@/lib/actions/case";
import SakClient from "./SakClient";
import { redirect } from "next/navigation";

export default async function SakPage() {
  const ctx = await getActiveContext();
  if (!ctx) redirect("/login");

  // Check sak module permission
  const sb = await createClient();
  const { data: member } = await sb
    .from("group_members")
    .select("permissions, role")
    .eq("group_id", ctx.group.id)
    .eq("profile_id", ctx.user.id)
    .single();

  const perms = (member?.permissions as Record<string, boolean>) ?? {};
  const role = member?.role ?? "member";
  const canAccess =
    role === "owner" || role === "admin" || perms["sak"] === true;

  if (!canAccess) redirect("/");

  const [events, documents] = await Promise.all([
    getCaseEvents(),
    getCaseDocuments(),
  ]);

  return <SakClient events={events} documents={documents} />;
}
