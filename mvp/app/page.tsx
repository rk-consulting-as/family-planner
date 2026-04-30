import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Calendar, CheckSquare, Trophy, Footprints, Users } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="container mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-brand-600 text-white grid place-items-center font-bold">F</div>
          <span className="font-semibold">Family Planner</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/sign-in" className="text-sm font-medium text-slate-700 hover:text-brand-700">
            Logg inn
          </Link>
          <Link href="/sign-up">
            <Button>Kom i gang</Button>
          </Link>
        </nav>
      </header>

      <section className="container mx-auto px-6 pt-12 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 max-w-3xl mx-auto">
          Hverdagslogistikk for familien — på ett sted.
        </h1>
        <p className="mt-5 text-lg text-slate-600 max-w-2xl mx-auto">
          Skoletimer, gjøremål, belønninger, gå-tur og delt familiekalender.
          Bygget for å være morsom for barna og oversiktlig for foreldrene.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/sign-up">
            <Button size="lg">Opprett gratis familie</Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="secondary">
              Logg inn
            </Button>
          </Link>
        </div>
      </section>

      <section className="container mx-auto px-6 pb-20 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Feature icon={<Calendar />} title="Ukekalender" desc="Visuell oversikt for hele familien." />
        <Feature icon={<CheckSquare />} title="Gjøremål" desc="Tildel direkte eller la barna velge fra pool." />
        <Feature icon={<Trophy />} title="Belønninger" desc="Penger, skjermtid, poeng eller badges." />
        <Feature icon={<Footprints />} title="Gå-tracker" desc="Logg turer, sett ukentlige mål." />
        <Feature icon={<Users />} title="Familieroller" desc="Foreldre, barn, voksne — alle har sin rolle." />
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        Bygget med Next.js + Supabase. © {new Date().getFullYear()} Family Planner.
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 grid place-items-center mb-3">
        {icon}
      </div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500 mt-1">{desc}</p>
    </div>
  );
}
