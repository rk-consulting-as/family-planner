"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import {
  addShoppingItem,
  togglePurchased,
  deleteShoppingItem,
  clearPurchased,
} from "@/lib/actions/meals";

const CATEGORIES = [
  { key: "frukt", label: "Frukt & grønt", icon: "🥬" },
  { key: "kjøtt", label: "Kjøtt & fisk", icon: "🥩" },
  { key: "meieri", label: "Meieri & egg", icon: "🥛" },
  { key: "kjøl", label: "Kjøl & ferskvarer", icon: "🥶" },
  { key: "frys", label: "Frys", icon: "🧊" },
  { key: "tørrvarer", label: "Tørrvarer", icon: "🍝" },
  { key: "drikke", label: "Drikke", icon: "🥤" },
  { key: "snacks", label: "Snacks & søtt", icon: "🍪" },
  { key: "hygiene", label: "Hygiene", icon: "🧴" },
  { key: "annet", label: "Annet", icon: "🛍️" },
] as const;

type Item = {
  id: string;
  name: string;
  quantity: string | null;
  category: string;
  notes: string | null;
  is_purchased: boolean;
  purchased_by: string | null;
  added_by: string;
  created_at: string;
};

type Member = { profile_id: string; display_name: string };

export default function HandlelisteShell({
  groupId,
  members,
  initialItems,
}: {
  groupId: string;
  members: Member[];
  initialItems: Item[];
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [pending, startTransition] = useTransition();

  // Realtime
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`shop:${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_list_items", filter: `group_id=eq.${groupId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const n = payload.new as Item;
            setItems((cur) => (cur.some((x) => x.id === n.id) ? cur : [...cur, n]));
          } else if (payload.eventType === "UPDATE") {
            const n = payload.new as Item;
            setItems((cur) => cur.map((x) => (x.id === n.id ? n : x)));
          } else if (payload.eventType === "DELETE") {
            const o = payload.old as Item;
            setItems((cur) => cur.filter((x) => x.id !== o.id));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  const grouped = useMemo(() => {
    const open: Record<string, Item[]> = {};
    const done: Item[] = [];
    for (const it of items) {
      if (it.is_purchased) {
        done.push(it);
      } else {
        const k = it.category || "annet";
        if (!open[k]) open[k] = [];
        open[k].push(it);
      }
    }
    return { open, done };
  }, [items]);

  function nameOf(id: string | null) {
    if (!id) return "?";
    return members.find((m) => m.profile_id === id)?.display_name || "?";
  }

  function handleAdd(formData: FormData) {
    startTransition(async () => {
      await addShoppingItem(groupId, formData);
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>+ Legg til vare</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            action={(fd) => {
              handleAdd(fd);
              const form = document.getElementById("add-shop-form") as HTMLFormElement | null;
              form?.reset();
            }}
            id="add-shop-form"
            className="grid sm:grid-cols-[1fr_120px_180px_auto] gap-2 items-end"
          >
            <Field label="Vare">
              <Input name="name" required placeholder="F.eks. Melk" />
            </Field>
            <Field label="Antall (valgfri)">
              <Input name="quantity" placeholder="2 stk / 500g" />
            </Field>
            <Field label="Kategori">
              <Select name="category" defaultValue="annet">
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" disabled={pending}>Legg til</Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Å handle ({Object.values(grouped.open).flat().length})</CardTitle>
        </CardHeader>
        <CardBody>
          {Object.values(grouped.open).flat().length === 0 ? (
            <p className="text-sm text-slate-500">Ingenting på lista akkurat nå 🎉</p>
          ) : (
            <div className="space-y-4">
              {CATEGORIES.map((cat) => {
                const list = grouped.open[cat.key];
                if (!list || list.length === 0) return null;
                return (
                  <div key={cat.key}>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                      <span className="mr-1">{cat.icon}</span> {cat.label}
                    </div>
                    <ul className="space-y-1">
                      {list.map((it) => (
                        <li
                          key={it.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() =>
                              startTransition(async () => {
                                await togglePurchased(it.id, true);
                              })
                            }
                            className="w-5 h-5 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">
                              {it.name}
                              {it.quantity && (
                                <span className="text-slate-500 font-normal ml-2 text-sm">
                                  {it.quantity}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              Lagt til av {nameOf(it.added_by)}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              startTransition(async () => {
                                await deleteShoppingItem(it.id);
                              })
                            }
                            className="text-slate-400 hover:text-red-600 text-lg"
                            title="Slett"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {grouped.done.length > 0 && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Handlet ({grouped.done.length})</CardTitle>
            <form
              action={() => {
                if (!confirm(`Slette ${grouped.done.length} merket varer?`)) return;
                startTransition(async () => {
                  await clearPurchased(groupId);
                });
              }}
            >
              <Button size="sm" variant="ghost" type="submit">
                Tøm handlet
              </Button>
            </form>
          </CardHeader>
          <CardBody>
            <ul className="space-y-1">
              {grouped.done.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 opacity-60"
                >
                  <input
                    type="checkbox"
                    checked={true}
                    onChange={() =>
                      startTransition(async () => {
                        await togglePurchased(it.id, false);
                      })
                    }
                    className="w-5 h-5 rounded"
                  />
                  <div className="flex-1 min-w-0 line-through">
                    <div className="font-medium">
                      {it.name}
                      {it.quantity && <span className="ml-2 text-sm">{it.quantity}</span>}
                    </div>
                    {it.purchased_by && (
                      <div className="text-xs text-slate-500 no-underline">
                        Handlet av {nameOf(it.purchased_by)}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </>
  );
}
