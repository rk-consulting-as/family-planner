import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import HandlelisteShell from "./HandlelisteShell";

export default async function HandlelistePage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: itemsRaw } = await supabase
    .from("shopping_list_items")
    .select(
      "id, name, quantity, category, notes, is_purchased, purchased_by, added_by, created_at"
    )
    .eq("group_id", ctx.group.id)
    .order("created_at", { ascending: true });

  type Item = {
    id: string;
    name: string;
    quantity: string | null;
    category: string;
    notes: string | null;
    is_purchased: boolean;
    purchased_by: string | null;
    added_by: string;
    created_at: string;
  };
  const items = (itemsRaw || []) as Item[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            🛒 Handleliste
          </h1>
          <p className="text-slate-600 text-sm">
            Live: alle ser endringer umiddelbart.
          </p>
        </div>
        <Link href="/maltidsplan">
          <Button size="sm" variant="secondary">🍽️ Måltidsplan</Button>
        </Link>
      </div>

      <HandlelisteShell
        groupId={ctx.group.id}
        members={ctx.members}
        initialItems={items}
      />
    </div>
  );
}
