"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, Select } from "@/components/ui/Input";
import { createInvitationLink } from "@/lib/actions/invitations";
import { Mail, MessageSquare, Copy, Share2, Check } from "lucide-react";

export default function InviteForm({
  groupId,
  isAdmin,
}: {
  groupId: string;
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  function handle(formData: FormData) {
    setError(null);
    setLink(null);
    startTransition(async () => {
      const res = await createInvitationLink(groupId, formData);
      if (!res.ok || !res.url) {
        setError(res.error || "Klarte ikke å opprette");
        return;
      }
      setLink(res.url);
    });
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback handled by select
    }
  }

  async function nativeShare() {
    if (!link) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "Bli med i familien min",
          text: message || "Du er invitert til familiens planlegger",
          url: link,
        });
      } catch {
        // bruker avbrøt
      }
    } else {
      copyLink();
    }
  }

  const subject = encodeURIComponent("Bli med i familiens planlegger");
  const body = encodeURIComponent(
    `${message ? message + "\n\n" : ""}Klikk på lenken for å bli med:\n${link || ""}`
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lag invitasjonslenke</CardTitle>
      </CardHeader>
      <CardBody>
        <form action={handle} className="space-y-4">
          <Field label="Epost (valgfri)" hint="Bare for å huske hvem invitasjonen er ment for">
            <Input
              type="email"
              name="invited_email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="venn@example.com"
            />
          </Field>

          <Field label="Personlig melding (valgfri)">
            <Textarea
              name="personal_message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hei! Vil du bli med i familieplanleggeren vår?"
              rows={2}
            />
          </Field>

          {isAdmin && (
            <Field label="Rolle">
              <Select name="role" defaultValue="member">
                <option value="member">Medlem</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}

          <Button type="submit" disabled={pending}>
            {pending ? "Lager…" : "Lag delbar lenke"}
          </Button>
        </form>

        {link && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="text-sm font-medium text-emerald-900 mb-2">
              ✓ Lenken er klar!
            </p>
            <div className="bg-white rounded-lg border border-emerald-200 p-2 mb-3 break-all text-xs font-mono">
              {link}
            </div>
            <p className="text-xs text-slate-600 mb-3">
              {isAdmin
                ? "Mottaker blir lagt direkte til når de aksepterer."
                : "Mottaker venter på godkjenning fra admin etter at de har akseptert."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={copyLink}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Kopiert!" : "Kopier lenke"}
              </Button>
              <Button size="sm" variant="secondary" onClick={nativeShare}>
                <Share2 className="w-4 h-4" /> Del
              </Button>
              <a href={`mailto:${email}?subject=${subject}&body=${body}`}>
                <Button size="sm" variant="secondary" type="button">
                  <Mail className="w-4 h-4" /> Send via epost
                </Button>
              </a>
              <a href={`sms:?&body=${body}`}>
                <Button size="sm" variant="secondary" type="button">
                  <MessageSquare className="w-4 h-4" /> Send via SMS
                </Button>
              </a>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
