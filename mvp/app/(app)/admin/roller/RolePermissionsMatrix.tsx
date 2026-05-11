"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  ACTIONS,
  ACTION_CATEGORIES,
  ROLES_TO_SHOW,
  ROLE_LABELS,
} from "@/lib/role-actions";
import { setRolePermission } from "@/lib/actions/role-permissions";

type Caps = Record<string, Record<string, boolean>>;

export default function RolePermissionsMatrix({
  groupId,
  capabilities,
}: {
  groupId: string;
  capabilities: Caps;
}) {
  const [caps, setCaps] = useState<Caps>(capabilities);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const byCategory = useMemo(() => {
    const map = new Map<string, typeof ACTIONS>();
    for (const a of ACTIONS) {
      const arr = map.get(a.category) || [];
      arr.push(a);
      map.set(a.category, arr);
    }
    return map;
  }, []);

  function toggle(role: "admin" | "parent" | "member", action: string) {
    const old = caps[role]?.[action] ?? false;
    const next = !old;
    setCaps((cur) => ({
      ...cur,
      [role]: { ...cur[role], [action]: next },
    }));
    setError(null);
    setSaving(`${role}-${action}`);
    startTransition(async () => {
      const res = await setRolePermission(groupId, role, action, next);
      setSaving(null);
      if (res && !res.ok) {
        setCaps((cur) => ({
          ...cur,
          [role]: { ...cur[role], [action]: old },
        }));
        setError(res.error || "Klarte ikke å lagre");
      }
    });
  }

  return (
    <>
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <strong>Feil:</strong> {error}
        </div>
      )}

      {ACTION_CATEGORIES.map((cat) => {
        const items = byCategory.get(cat.key);
        if (!items || items.length === 0) return null;
        return (
          <Card key={cat.key}>
            <CardHeader>
              <CardTitle>
                <span className="text-xl mr-2">{cat.icon}</span>
                {cat.label}
              </CardTitle>
            </CardHeader>
            <CardBody className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium text-slate-500 pb-2">
                      Handling
                    </th>
                    {ROLES_TO_SHOW.map((role) => (
                      <th
                        key={role}
                        className="text-center text-xs font-medium text-slate-700 pb-2 px-2 min-w-[100px]"
                      >
                        <div className="text-base">{ROLE_LABELS[role].icon}</div>
                        <div>{ROLE_LABELS[role].label}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((a) => (
                    <tr key={a.key}>
                      <td className="py-2 pr-3 align-top">
                        <div className="font-medium">{a.label}</div>
                        <div className="text-xs text-slate-500">{a.description}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {a.key}
                        </div>
                      </td>
                      {ROLES_TO_SHOW.map((role) => {
                        const allowed = caps[role]?.[a.key] ?? false;
                        const disabled = a.owner_only;
                        const cellSaving = saving === `${role}-${a.key}`;
                        return (
                          <td key={role} className="py-2 px-2 text-center">
                            {disabled ? (
                              <span className="text-xs text-slate-400">— kun owner</span>
                            ) : (
                              <button
                                onClick={() => toggle(role, a.key)}
                                disabled={pending}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                                  allowed ? "bg-emerald-500" : "bg-slate-300"
                                } ${cellSaving ? "opacity-50" : ""}`}
                                aria-label={`Toggle ${a.label} for ${role}`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                    allowed ? "translate-x-6" : "translate-x-1"
                                  }`}
                                />
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        );
      })}

      <p className="text-xs text-slate-500 text-center">
        💡 Owner ({ROLE_LABELS.owner.icon}) har alltid full tilgang og vises ikke i
        matrisen.
      </p>
    </>
  );
}
