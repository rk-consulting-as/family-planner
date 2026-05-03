import { notFound } from "next/navigation";
import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Linkify } from "@/components/ui/Linkify";
import { setNeedStatus, deleteNeed, deleteNeedComment } from "@/lib/actions/needs";
import EditNeedSection from "./EditNeedSection";
import CommentForm from "./CommentForm";
import AttachmentUploader from "./AttachmentUploader";

export default async function NeedDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: needRaw } = await supabase
    .from("needs")
    .select(
      "id, group_id, title, description, category, priority, status, visible_to, location_note, requested_by, fulfilled_at, fulfilled_note, created_at, updated_at"
    )
    .eq("id", params.id)
    .single();

  type Need = {
    id: string;
    group_id: string;
    title: string;
    description: string | null;
    category: string | null;
    priority: "low" | "normal" | "high";
    status: "open" | "in_progress" | "fulfilled" | "cancelled";
    visible_to: string[];
    location_note: string | null;
    requested_by: string;
    fulfilled_at: string | null;
    fulfilled_note: string | null;
    created_at: string;
    updated_at: string;
  };
  const need = needRaw as Need | null;
  if (!need) notFound();

  const requester = ctx.members.find((m) => m.profile_id === need.requested_by);
  const isAdmin = ctx.role !== "member";
  const isAuthor = need.requested_by === ctx.user.id;
  const canEdit = isAuthor || isAdmin;
  const isClosed = need.status === "fulfilled" || need.status === "cancelled";

  const visibleNames =
    need.visible_to.length === 0
      ? "Alle voksne"
      : need.visible_to
          .map((id) => ctx.members.find((m) => m.profile_id === id)?.display_name)
          .filter(Boolean)
          .join(", ");

  const [{ data: comments }, { data: attachments }, { data: history }] = await Promise.all([
    supabase
      .from("need_comments")
      .select("id, body, author_id, created_at, updated_at")
      .eq("need_id", need.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("need_attachments")
      .select("id, kind, public_url, filename, mime_type, uploaded_by, created_at")
      .eq("need_id", need.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("need_history")
      .select("id, edited_by, field, old_value, new_value, created_at")
      .eq("need_id", need.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  type Comment = {
    id: string;
    body: string;
    author_id: string;
    created_at: string;
    updated_at: string;
  };
  type Attachment = {
    id: string;
    kind: "image" | "file";
    public_url: string;
    filename: string | null;
    mime_type: string | null;
    uploaded_by: string;
    created_at: string;
  };
  type HistoryRow = {
    id: string;
    edited_by: string | null;
    field: string;
    old_value: unknown;
    new_value: unknown;
    created_at: string;
  };
  const commentList = (comments || []) as Comment[];
  const attList = (attachments || []) as Attachment[];
  const historyList = (history || []) as HistoryRow[];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/onsker" className="text-sm text-brand-700 hover:underline">
          ← Tilbake til ønsker
        </Link>
        <div className="flex items-start justify-between gap-3 mt-1">
          <div>
            <h1 className="text-2xl font-bold">{need.title}</h1>
            <div className="text-sm text-slate-600 mt-1">
              Fra <strong>{requester?.display_name || "?"}</strong>
              {need.location_note && <> • Hvor: {need.location_note}</>} • Synlig for: {visibleNames}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge variant={statusVariant(need.status)}>{statusLabel(need.status)}</Badge>
            <Badge variant={priorityVariant(need.priority)}>{priorityLabel(need.priority)}</Badge>
            {need.category && <Badge>{need.category}</Badge>}
          </div>
        </div>
      </div>

      {need.description && (
        <Card>
          <CardBody>
            <Linkify text={need.description} className="text-sm leading-relaxed" />
          </CardBody>
        </Card>
      )}

      {/* Status-handlinger */}
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Handlinger</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {!isClosed && need.status === "open" && (
                <form
                  action={async () => {
                    "use server";
                    await setNeedStatus(need.id, "in_progress");
                  }}
                >
                  <Button size="sm" variant="secondary">På vei</Button>
                </form>
              )}
              {!isClosed && (
                <form
                  action={async () => {
                    "use server";
                    await setNeedStatus(need.id, "fulfilled");
                  }}
                >
                  <Button size="sm">Fullført</Button>
                </form>
              )}
              {!isClosed && (
                <form
                  action={async () => {
                    "use server";
                    await setNeedStatus(need.id, "cancelled");
                  }}
                >
                  <Button size="sm" variant="ghost">Avbryt</Button>
                </form>
              )}
              {isClosed && need.status !== "open" && (
                <form
                  action={async () => {
                    "use server";
                    await setNeedStatus(need.id, "open");
                  }}
                >
                  <Button size="sm" variant="secondary">Gjenåpne</Button>
                </form>
              )}
              {isAdmin && (
                <form
                  action={async () => {
                    "use server";
                    await deleteNeed(need.id);
                  }}
                >
                  <Button size="sm" variant="destructive">Slett ønske</Button>
                </form>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Vedlegg */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Vedlegg ({attList.length})</CardTitle>
        </CardHeader>
        <CardBody>
          <AttachmentUploader needId={need.id} canUpload={ctx.role !== "member" || isAuthor} />
          {attList.length === 0 ? (
            <p className="text-sm text-slate-500 mt-3">Ingen vedlegg ennå.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-3">
              {attList.map((att) => (
                <a
                  key={att.id}
                  href={att.public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square rounded-lg overflow-hidden bg-slate-100 hover:opacity-90"
                >
                  {att.kind === "image" ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={att.public_url} alt={att.filename || "vedlegg"} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-xs text-slate-600 p-2 text-center">
                      📎 {att.filename || "fil"}
                    </div>
                  )}
                </a>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Rediger */}
      {canEdit && (
        <EditNeedSection
          need={{
            id: need.id,
            title: need.title,
            description: need.description,
            category: need.category,
            priority: need.priority,
            location_note: need.location_note,
          }}
        />
      )}

      {/* Kommentartråd */}
      <Card>
        <CardHeader>
          <CardTitle>Samtale ({commentList.length})</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {commentList.length === 0 ? (
            <p className="text-sm text-slate-500">
              Ingen kommentarer. Still et spørsmål eller gi tilbakemelding.
            </p>
          ) : (
            <ul className="space-y-3">
              {commentList.map((c) => {
                const author = ctx.members.find((m) => m.profile_id === c.author_id);
                const mine = c.author_id === ctx.user.id;
                return (
                  <li key={c.id} className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
                    <span
                      className="w-8 h-8 rounded-full grid place-items-center text-white text-sm font-semibold flex-shrink-0"
                      style={{ background: author?.color_hex || "#7C3AED" }}
                    >
                      {author?.display_name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className={`max-w-[70%] ${mine ? "items-end" : ""} flex flex-col`}>
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm ${
                          mine ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-900"
                        }`}
                      >
                        <Linkify text={c.body} />
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        {author?.display_name} • {c.created_at.replace("T", " ").slice(0, 16)}
                        {mine && (
                          <form
                            action={async () => {
                              "use server";
                              await deleteNeedComment(c.id, need.id);
                            }}
                          >
                            <button className="text-slate-400 hover:text-red-600">slett</button>
                          </form>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <CommentForm needId={need.id} />
        </CardBody>
      </Card>

      {/* Historikk */}
      {historyList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Endringslogg ({historyList.length})</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2">
              {historyList.map((h) => {
                const who = ctx.members.find((m) => m.profile_id === h.edited_by);
                return (
                  <li key={h.id} className="text-xs text-slate-600">
                    <span className="font-medium">{who?.display_name || "?"}</span> endret{" "}
                    <span className="font-medium">{fieldLabel(h.field)}</span>: {fmtVal(h.old_value)} → {fmtVal(h.new_value)}
                    <span className="text-slate-400 ml-1">
                      ({h.created_at.replace("T", " ").slice(0, 16)})
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function fmtVal(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}

function fieldLabel(f: string) {
  return (
    {
      title: "tittel",
      description: "beskrivelse",
      category: "kategori",
      priority: "prioritet",
      location_note: "plassering",
      status: "status",
    }[f] || f
  );
}

function statusLabel(s: string) {
  return ({ open: "Åpen", in_progress: "På vei", fulfilled: "Fullført", cancelled: "Avbrutt" }[s] || s);
}

function statusVariant(s: string): "default" | "info" | "success" {
  return s === "fulfilled" ? "success" : s === "in_progress" ? "info" : "default";
}

function priorityLabel(p: string) {
  return ({ low: "Lav", normal: "Normal", high: "Høy" }[p] || p);
}

function priorityVariant(p: string): "default" | "warning" | "danger" {
  return p === "high" ? "danger" : p === "low" ? "default" : "warning";
}
