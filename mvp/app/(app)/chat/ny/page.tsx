import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { createGroupChat } from "@/lib/actions/chat";

export default async function NyChatPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <Link href="/chat" className="text-sm text-brand-700 hover:underline">
          ← Tilbake
        </Link>
        <h1 className="text-2xl font-bold mt-1">Ny gruppe-chat</h1>
        <p className="text-slate-600 text-sm">
          Velg navn og medlemmer. Du legges til automatisk.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detaljer</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            action={async (fd) => {
              "use server";
              await createGroupChat(ctx.group.id, fd);
            }}
            className="space-y-4"
          >
            <Field label="Gruppenavn">
              <Input
                name="name"
                required
                placeholder="F.eks. Familieforhandlinger 🤝"
                maxLength={60}
              />
            </Field>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Hvem skal være med?
              </label>
              <div className="flex flex-wrap gap-2">
                {ctx.members
                  .filter((m) => m.profile_id !== ctx.user.id)
                  .map((m) => (
                    <label
                      key={m.profile_id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 cursor-pointer hover:bg-slate-50 text-sm"
                    >
                      <input type="checkbox" name="member_ids" value={m.profile_id} />
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: m.color_hex || "#7C3AED" }}
                      />
                      {m.display_name}
                    </label>
                  ))}
              </div>
            </div>

            <Button type="submit">Opprett samtale</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
