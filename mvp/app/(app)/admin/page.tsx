import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/queries";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Users, CheckSquare, Calendar, Trophy } from "lucide-react";

export default async function AdminPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;
  if (ctx.role === "member") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-slate-600 text-sm">Administrer {ctx.group.name}.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminLink href="/admin/medlemmer" icon={<Users />} label="Medlemmer" />
        <AdminLink href="/admin/gjoremal" icon={<CheckSquare />} label="Gjøremål" />
        <AdminLink href="/admin/godkjenninger" icon={<Trophy />} label="Godkjenninger" />
        <AdminLink href="/timeplan" icon={<Calendar />} label="Timeplan" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invitasjonskode</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-slate-600 mb-2">
            Del denne med personer du vil legge til:
          </p>
          <div className="font-mono font-bold tracking-widest text-2xl text-brand-700 bg-brand-50 inline-block px-4 py-2 rounded-lg">
            {ctx.group.invite_code}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            De skriver koden på onboarding-skjermen etter å ha registrert seg.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function AdminLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl bg-white border border-slate-200 p-5 hover:border-brand-300 hover:bg-brand-50 transition flex items-center gap-3"
    >
      <span className="text-brand-600 w-10 h-10 grid place-items-center bg-brand-50 rounded-xl">
        {icon}
      </span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}
