import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditWishClient from "./EditWishClient";

export default async function RedigerOnske({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: wish } = await supabase
    .from("aura_wishes")
    .select(
      "id, owner_id, list_id, title, description, brand, category, hero_image_url, price, original_price, product_url, notes, priority, status"
    )
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  if (!wish) notFound();
  type Wish = {
    id: string;
    owner_id: string;
    list_id: string | null;
    title: string;
    description: string | null;
    brand: string | null;
    category: string | null;
    hero_image_url: string | null;
    price: number | null;
    original_price: number | null;
    product_url: string | null;
    notes: string | null;
    priority: string;
    status: string;
  };
  const w = wish as Wish;
  if (w.owner_id !== user.id) redirect(`/aura/onske/${w.id}`);

  // Hent brukerens lister for valg
  const { data: lists } = await supabase
    .from("aura_wishlists")
    .select("id, title")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  return (
    <EditWishClient
      wish={w}
      lists={(lists || []) as Array<{ id: string; title: string }>}
    />
  );
}
