"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sjekk e-posten din</CardTitle>
          <CardDescription>
            Vi har sendt en lenke til <strong>{email}</strong>. Klikk på lenken for å velge nytt passord.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-slate-500 mb-4">
            Ikke fått e-post? Sjekk søppelpost, eller vent noen minutter.
          </p>
          <Link href="/sign-in" className="text-sm text-brand-700 font-medium">
            ← Tilbake til innlogging
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Glemt passord?</CardTitle>
        <CardDescription>
          Skriv inn e-postadressen din, så sender vi en lenke for å nullstille passordet.
        </CardDescription>
      </CardHeader>
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="E-post">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="din@epost.no"
            />
          </Field>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sender..." : "Send tilbakestillingslenke"}
          </Button>
        </form>
        <div className="mt-4 text-sm text-slate-600 text-center">
          <Link href="/sign-in" className="text-brand-700 font-medium">
            ← Tilbake til innlogging
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
