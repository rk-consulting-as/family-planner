import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { Shield, Users, FolderTree, LayoutDashboard } from "lucide-react";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getActiveContext();
  if (!ctx) redirect("/onboarding");
  if (!ctx.profile.is_system_admin) redirect("/dashboard");

  return (
    <div className="grid lg:grid-cols-[220px_1fr] gap-6">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl bg-white border border-amber-200 p-3">
          <div className="flex items-center gap-2 px-2 py-2 mb-2 text-amber-800">
            <Shield className="w-4 h-4" />
            <span className="font-semibold text-sm">Backoffice</span>
          </div>
          <nav className="space-y-1">
            <SideLink href="/superadmin" icon={<LayoutDashboard className="w-4 h-4" />}>
              Oversikt
            </SideLink>
            <SideLink href="/superadmin/grupper" icon={<FolderTree className="w-4 h-4" />}>
              Grupper
            </SideLink>
            <SideLink href="/superadmin/brukere" icon={<Users className="w-4 h-4" />}>
              Brukere
            </SideLink>
          </nav>
        </div>
      </aside>
      <div>{children}</div>
    </div>
  );
}

function SideLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-800"
    >
      {icon}
      {children}
    </Link>
  );
}
