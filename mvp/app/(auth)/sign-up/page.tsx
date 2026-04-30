"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (!data.session) {
      setInfo(
        "Vi har sendt deg en bekreftelses-e-post. Sjekk innboksen og klikk lenken for å fullføre."
      );
      setLoading(false);
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opprett konto</CardTitle>
        <CardDescription>Start din egen familie eller bli med i en eksisterende.</CardDescription>
      </CardHeader>
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Visningsnavn">
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ola Hansen"
              autoComplete="name"
            />
          </Field>
          <Field label="E-post">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>
          <Field label="Passord" hint="Min 8 tegn.">
            <Input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
          {info && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              {info}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Oppretter..." : "Opprett konto"}
          </Button>
        </form>
        <div className="mt-4 text-sm text-slate-600 text-center">
          Har du konto?{" "}
          <Link href="/sign-in" className="text-brand-700 font-medium">
            Logg inn
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
