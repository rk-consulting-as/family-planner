import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AddWishClient from "./AddWishClient";

export default async function LeggTilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: lists } = await supabase
    .from("aura_wishlists")
    .select("id, title")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  return <AddWishClient lists={(lists || []) as Array<{ id: string; title: string }>} />;
}
