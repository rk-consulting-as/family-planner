"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { createGroup, joinGroupByCode } from "@/lib/actions/groups";

export default function OnboardingClient() {
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [createPending, startCreate] = useTransition();
  const [joinPending, startJoin] = useTransition();

  function handleCreate(formData: FormData) {
    setCreateError(null);
    startCreate(async () => {
      const res = await createGroup(formData);
      if (res && !res.ok) setCreateError(res.error || "Ukjent feil");
      // Hvis det går bra, redirecter serveren til /dashboard
    });
  }

  function handleJoin(formData: FormData) {
    setJoinError(null);
    startJoin(async () => {
      const res = await joinGroupByCode(formData);
      if (res && !res.ok) setJoinError(res.error || "Ukjent feil");
    });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Velkommen!</h1>
        <p className="text-slate-600 mb-8">
          Opprett en ny familie/gruppe, eller bli med i en eksisterende.
        </p>

        <div className="grid sm:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Opprett ny</CardTitle>
              <CardDescription>Du blir admin og kan invitere medlemmer.</CardDescription>
            </CardHeader>
            <CardBody>
              <form action={handleCreate} className="space-y-4">
                <Field label="Navn">
                  <Input name="name" required placeholder="Familien Hansen" />
                </Field>
                <Field label="Type">
                  <Select name="type" defaultValue="family">
                    <option value="family">Familie</option>
                    <option value="team">Lag</option>
                    <option value="club">Klubb</option>
                    <option value="organization">Organisasjon</option>
                    <option value="other">Annet</option>
                  </Select>
                </Field>
                {createError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {createError}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={createPending}>
                  {createPending ? "Oppretter…" : "Opprett"}
                </Button>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bli med via kode</CardTitle>
              <CardDescription>Få en kode fra en admin i gruppen.</CardDescription>
            </CardHeader>
            <CardBody>
              <form action={handleJoin} className="space-y-4">
                <Field label="Invitasjonskode">
                  <Input
                    name="invite_code"
                    required
                    placeholder="ABC23DEF"
                    className="uppercase tracking-widest text-center"
                  />
                </Field>
                {joinError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {joinError}
                  </div>
                )}
                <Button type="submit" variant="secondary" className="w-full" disabled={joinPending}>
                  {joinPending ? "Blir med…" : "Bli med"}
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
