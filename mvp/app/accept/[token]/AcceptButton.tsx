"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { acceptInvitationByToken } from "@/lib/actions/invitations";

export default function AcceptButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; group_name?: string } | null>(null);
  const router = useRouter();

  function handle() {
    setErr(null);
    startTransition(async () => {
      const res = await acceptInvitationByToken(token);
      if (!res.ok) {
        setErr(res.error || "Kunne ikke akseptere");
        return;
      }
      setResult({ status: res.status || "approved", group_name: res.group_name });
      if (res.status === "approved") {
        setTimeout(() => router.push("/dashboard"), 1500);
      }
    });
  }

  if (result?.status === "approved") {
    return (
      <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
        🎉 Velkommen! Du er nå med i {result.group_name}. Sender deg til dashbordet…
      </div>
    );
  }

  if (result?.status === "awaiting_approval") {
    return (
      <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
        ⏳ Forespørselen er sendt til admin i <strong>{result.group_name}</strong>. Du får varsel
        når den er godkjent. Du kan lukke denne siden.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button onClick={handle} disabled={pending}>
        {pending ? "Aksepterer…" : "Aksepter invitasjon"}
      </Button>
      {err && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {err}
        </div>
      )}
    </div>
  );
}
