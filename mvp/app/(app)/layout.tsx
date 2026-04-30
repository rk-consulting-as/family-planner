import { redirect } from "next/navigation";
import { TopNav, MobileBottomNav } from "@/components/layout/TopNav";
import { getActiveContext } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getActiveContext();

  if (!ctx) {
    // Not in a group → onboarding
    redirect("/onboarding");
  }

  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  return (
    <div className="min-h-screen bg-slate-50 pb-16 md:pb-0">
      <TopNav
        groupName={ctx.group.name}
        isAdmin={isAdmin}
        displayName={ctx.profile.display_name}
      />
      <main className="container mx-auto px-4 sm:px-6 py-6">{children}</main>
      <MobileBottomNav isAdmin={isAdmin} />
    </div>
  );
}
