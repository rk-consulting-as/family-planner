import { notFound } from "next/navigation";
import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FACT_CATEGORIES } from "@/lib/fact-presets";
import NewFactForm from "./NewFactForm";
import FactRow from "./FactRow";

export default async function MedlemInfoPage({ params }: { params: { id: string } }) {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const member = ctx.members.find((m) => m.profile_id === params.id);
  if (!member) notFound();

  const supabase = await createClient();
  const { data: factsRaw } = await supabase
    .from("profile_facts")
    .select("id, category, label, value, icon, visibility, updated_at, updated_by")
    .eq("group_id", ctx.group.id)
    .eq("profile_id", params.id)
    .order("category", { ascending: true })
    .order("label", { ascending: true });

  type Fact = {
    id: string;
    category: string;
    label: string;
    value: string | null;
    icon: string | null;
    visibility: "group" | "admins_only" | "self_only";
    updated_at: string;
    updated_by: string | null;
  };
  const facts = (factsRaw || []) as Fact[];

  const isMe = params.id === ctx.user.id;
  const isAdmin = ctx.role !== "member";
  const canEdit = isMe || isAdmin;

  // Grupper per kategori
  const byCat = new Map<string, Fact[]>();
  for (const f of facts) {
    const arr = byCat.get(f.category) || [];
    arr.push(f);
    byCat.set(f.category, arr);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/admin/medlemmer" className="text-sm text-brand-700 hover:underline">
          ← Tilbake til medlemmer
        </Link>
        <h1 className="text-2xl font-bold mt-1">
          Info om {member.display_name}
        </h1>
        <p className="text-slate-600 text-sm">
          Viktig informasjon å huske: skostørrelse, allergier, favoritter osv.
        </p>
      </div>

      {canEdit && (
        <NewFactForm groupId={ctx.group.id} profileId={params.id} />
      )}

      {facts.length === 0 ? (
        <EmptyState
          title="Ingen info enda"
          description={canEdit ? "Bruk skjemaet over for å legge til." : "Ingen info delt enda."}
        />
      ) : (
        FACT_CATEGORIES.map((cat) => {
          const items = byCat.get(cat.key);
          if (!items || items.length === 0) return null;
          return (
            <Card key={cat.key}>
              <CardHeader>
                <CardTitle>
                  <span className="text-xl mr-2">{cat.icon}</span>
                  {cat.label}
                </CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="divide-y divide-slate-100">
                  {items.map((f) => (
                    <FactRow
                      key={f.id}
                      fact={f}
                      profileId={params.id}
                      canEdit={canEdit}
                    />
                  ))}
                </ul>
              </CardBody>
            </Card>
          );
        })
      )}
    </div>
  );
}
