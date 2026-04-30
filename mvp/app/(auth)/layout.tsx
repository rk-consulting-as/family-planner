import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="container mx-auto px-6 py-5">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center font-bold text-sm">
            F
          </div>
          <span className="font-semibold">Family Planner</span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
