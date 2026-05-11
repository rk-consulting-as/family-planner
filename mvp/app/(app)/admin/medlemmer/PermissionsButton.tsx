"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { MODULES } from "@/lib/modules";
import { setMemberModuleAccess } from "@/lib/actions/permissions";

export default function PermissionsButton({
  groupId,
  memberId,
  memberName,
  memberRole,
}: {
  groupId: string;
  memberId: string;
  memberName: string;
  memberRole: "owner" | "admin" | "member";
}) {
  const [open, setOpen] = useState(false);
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const supabase = createClient();
      // Hent eksisterende module_access for medlemmet
      const { data } = await supabase
        .from("group_members")
        .select("module_access")
        .eq("group_id", groupId)
        .eq("profile_id", memberId)
        .single();
      type R = { module_access?: Record<string, boolean> | null } | null;
      const explicit = (data as R)?.module_access || {};
      // Fyll inn defaults for moduler som ikke har eksplisitt verdi
      const fill: Record<string, boolean> = {};
      for (const m of MODULES) {
        if (m.key in explicit) {
          fill[m.key] = explicit[m.key];
        } else {
          fill[m.key] = m.default_member;
        }
      }
      setPerms(fill);
      setLoading(false);
    })();
  }, [open, groupId, memberId]);

  function toggle(key: string) {
    const oldVal = perms[key];
    const newVal = !oldVal;
    setPerms({ ...perms, [key]: newVal });
    setError(null);
    setSaving(key);
    startTransition(async () => {
      const res = await setMemberModuleAccess(groupId, memberId, key, newVal);
      setSaving(null);
      if (res && !res.ok) {
        // Rull tilbake
        setPerms((cur) => ({ ...cur, [key]: oldVal }));
        setError(res.error || "Klarte ikke å lagre");
      }
    });
  }

  if (memberRole !== "member") {
    return (
      <Button size="sm" variant="ghost" disabled title="Admins/eiere har full tilgang">
        🔒 Full tilgang
      </Button>
    );
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        🔐 Tilganger
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4 overflow-y-auto" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Tilganger for {memberName}</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Skru av/på modulene dette medlemmet skal se. Endringer lagres umiddelbart.
        </p>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            <strong>Feil:</strong> {error}
            <div className="text-xs mt-1">
              Sjekk at SQL-migrasjon 0026 er kjørt i Supabase.
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Laster…</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {MODULES.map((m) => (
              <li key={m.key} className="py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{m.icon}</span>
                  <span className="text-sm">{m.label}</span>
                </div>
                <button
                  onClick={() => toggle(m.key)}
                  disabled={pending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    perms[m.key] ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      perms[m.key] ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
