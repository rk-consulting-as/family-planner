"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Input";
import {
  deleteParty,
  mergeParties,
  unmergeParty,
} from "@/lib/actions/projects";
import AddPartyForm from "./AddPartyForm";

type Party = {
  id: string;
  name: string;
  role: string | null;
  organization: string | null;
  contact_info: string | null;
  notes: string | null;
  is_internal: boolean;
  merged_into_id: string | null;
};

export default function PartiesSection({
  projectId,
  parties,
}: {
  projectId: string;
  parties: Party[];
}) {
  const active = useMemo(() => parties.filter((p) => !p.merged_into_id), [parties]);
  const merged = useMemo(() => parties.filter((p) => p.merged_into_id), [parties]);

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [canonical, setCanonical] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [showMerged, setShowMerged] = useState(false);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    if (canonical === id && !next.has(id)) setCanonical("");
  }

  function startMerging() {
    setSelecting(true);
    setSelected(new Set());
    setCanonical("");
  }

  function cancelMerging() {
    setSelecting(false);
    setSelected(new Set());
    setCanonical("");
  }

  function handleMerge() {
    if (!canonical || selected.size < 2) return;
    const toMerge = Array.from(selected).filter((id) => id !== canonical);
    startTransition(async () => {
      await mergeParties(projectId, canonical, toMerge);
      cancelMerging();
    });
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2 flex-wrap">
        <CardTitle>Instanser & personer ({active.length})</CardTitle>
        {!selecting && active.length >= 2 && (
          <Button size="sm" variant="secondary" onClick={startMerging}>
            🔗 Slå sammen
          </Button>
        )}
        {selecting && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-600">
              Valgt: {selected.size}
            </span>
            {selected.size >= 2 && (
              <Select
                value={canonical}
                onChange={(e) => setCanonical(e.target.value)}
              >
                <option value="">Velg hvem som beholdes…</option>
                {Array.from(selected).map((id) => {
                  const p = active.find((a) => a.id === id);
                  if (!p) return null;
                  return (
                    <option key={id} value={id}>
                      {p.name} {p.role ? `(${p.role})` : ""}
                    </option>
                  );
                })}
              </Select>
            )}
            <Button
              size="sm"
              onClick={handleMerge}
              disabled={pending || !canonical || selected.size < 2}
            >
              Slå sammen
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelMerging}>
              Avbryt
            </Button>
          </div>
        )}
      </CardHeader>
      <CardBody>
        {selecting && (
          <p className="text-xs text-slate-500 mb-3">
            💡 Kryss av to eller flere som er samme person/instans, velg hvilken som
            beholdes, klikk "Slå sammen". De andre skjules men kan gjenopprettes.
          </p>
        )}

        {active.length === 0 ? (
          <p className="text-sm text-slate-500 mb-3">Ingen lagt til ennå.</p>
        ) : (
          <ul className="divide-y divide-slate-100 mb-4">
            {active.map((pt) => (
              <li key={pt.id} className="py-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {selecting && (
                    <input
                      type="checkbox"
                      checked={selected.has(pt.id)}
                      onChange={() => toggle(pt.id)}
                    />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      {pt.name}
                      {pt.is_internal && <Badge>Internt</Badge>}
                    </div>
                    <div className="text-xs text-slate-500">
                      {[pt.role, pt.organization].filter(Boolean).join(" • ")}
                      {pt.contact_info && ` • ${pt.contact_info}`}
                    </div>
                  </div>
                </div>
                {!selecting && (
                  <form
                    action={async () => {
                      await deleteParty(pt.id, projectId);
                    }}
                  >
                    <button className="text-xs text-slate-400 hover:text-red-600">
                      Slett
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {merged.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowMerged((v) => !v)}
              className="text-xs text-slate-600 hover:text-brand-700"
            >
              {showMerged ? "▾" : "▸"} Slått sammen ({merged.length})
            </button>
            {showMerged && (
              <ul className="mt-2 space-y-1 pl-4">
                {merged.map((pt) => {
                  const into = active.find((a) => a.id === pt.merged_into_id);
                  return (
                    <li
                      key={pt.id}
                      className="py-1.5 flex items-center justify-between text-xs text-slate-600"
                    >
                      <div>
                        <span className="line-through">{pt.name}</span>
                        {into && <span className="ml-2">→ {into.name}</span>}
                      </div>
                      <button
                        onClick={() => {
                          startTransition(async () => {
                            await unmergeParty(pt.id, projectId);
                          });
                        }}
                        className="text-brand-700 hover:underline"
                      >
                        Gjenopprett
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <div className="mt-4">
          <AddPartyForm projectId={projectId} />
        </div>
      </CardBody>
    </Card>
  );
}
