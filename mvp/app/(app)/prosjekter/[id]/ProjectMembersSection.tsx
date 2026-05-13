"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { addProjectMember, removeProjectMember } from "@/lib/actions/projects";

type Member = {
  profile_id: string;
  display_name: string;
  color_hex: string | null;
  role: string;
};

type GroupMember = {
  profile_id: string;
  display_name: string;
  color_hex: string | null;
};

export default function ProjectMembersSection({
  projectId,
  members,
  groupMembers,
  isCreator,
  currentUserId,
}: {
  projectId: string;
  members: Member[];
  groupMembers: GroupMember[];
  isCreator: boolean;
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const memberIds = new Set(members.map((m) => m.profile_id));
  const candidates = groupMembers.filter((g) => !memberIds.has(g.profile_id));

  function handleAdd(profileId: string) {
    setError(null);
    startTransition(async () => {
      const res = await addProjectMember(projectId, profileId);
      if (!res.ok) setError(res.error || "Klarte ikke å legge til");
    });
  }

  function handleRemove(profileId: string, name: string) {
    if (profileId === currentUserId) {
      if (!confirm("Du fjerner deg selv fra prosjektet — du mister tilgang. Fortsette?")) return;
    } else if (!confirm(`Fjerne ${name} fra prosjektet?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await removeProjectMember(projectId, profileId);
      if (!res.ok) setError(res.error || "Klarte ikke å fjerne");
    });
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Prosjektmedlemmer ({members.length})</CardTitle>
        {isCreator && candidates.length > 0 && !open && (
          <Button size="sm" onClick={() => setOpen(true)}>
            + Legg til
          </Button>
        )}
      </CardHeader>
      <CardBody className="space-y-3">
        {open && isCreator && (
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Velg fra gruppen</p>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none"
              >
                ×
              </button>
            </div>
            {candidates.length === 0 ? (
              <p className="text-sm text-slate-500">
                Alle gruppemedlemmer er allerede med.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {candidates.map((c) => (
                  <button
                    key={c.profile_id}
                    onClick={() => handleAdd(c.profile_id)}
                    disabled={pending}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-brand-50 hover:border-brand-300 text-sm disabled:opacity-50"
                  >
                    {c.color_hex && (
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: c.color_hex }}
                      />
                    )}
                    + {c.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </p>
        )}

        {members.length === 0 ? (
          <p className="text-sm text-slate-500">
            Ingen medlemmer enda.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <li
                key={m.profile_id}
                className="py-2 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {m.color_hex && (
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: m.color_hex }}
                    />
                  )}
                  <span className="font-medium text-sm">{m.display_name}</span>
                  {m.profile_id === currentUserId && (
                    <span className="text-xs text-slate-400">(meg)</span>
                  )}
                  <span className="text-xs text-slate-500">• {m.role}</span>
                </div>
                {isCreator && (
                  <button
                    onClick={() => handleRemove(m.profile_id, m.display_name)}
                    disabled={pending}
                    className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-50"
                  >
                    Fjern
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!isCreator && (
          <p className="text-xs text-slate-400">
            Bare prosjekt-eier kan endre medlemmer.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
