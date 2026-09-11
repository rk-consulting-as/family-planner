"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { attachFileToMilestone, linkDocumentToMilestone } from "@/lib/actions/projects";
import { X } from "lucide-react";

export type LinkableDoc = {
  id: string;
  title: string;
  kind: string;
  public_url: string | null;
  source_date: string | null;
  created_at: string;
};

export default function MilestoneAttachmentUploader({
  milestoneId,
  projectId,
  hasFileLink = false,
  currentDocumentId = null,
  currentDocumentTitle = null,
  docs = [],
}: {
  milestoneId: string;
  projectId: string;
  hasFileLink?: boolean;
  currentDocumentId?: string | null;
  currentDocumentTitle?: string | null;
  docs?: LinkableDoc[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sortedDocs = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return [...docs]
      .filter((d) => {
        if (d.id === currentDocumentId) return false;
        if (!q) return true;
        return (
          d.title.toLowerCase().includes(q) ||
          d.kind.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Fil-vedlegg først, deretter nyeste
        const aFile = a.public_url ? 0 : 1;
        const bFile = b.public_url ? 0 : 1;
        if (aFile !== bFile) return aFile - bFile;
        return b.created_at.localeCompare(a.created_at);
      });
  }, [docs, filter, currentDocumentId]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > 15 * 1024 * 1024) {
      setError("Filen er for stor (maks 15 MB)");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Ikke innlogget");
        return;
      }
      const safeName = file.name.replace(/[^a-z0-9._-]+/gi, "_");
      const path = `${user.id}/projects/${projectId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("attachments")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) {
        setError("Opplasting feilet: " + upErr.message);
        return;
      }
      const { data: pub } = supabase.storage.from("attachments").getPublicUrl(path);
      startTransition(async () => {
        const res = await attachFileToMilestone(milestoneId, projectId, {
          storage_path: path,
          public_url: pub.publicUrl,
          title: file.name.replace(/\.[^.]+$/, "") || file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
        });
        if (!res.ok) setError(res.error || "Klarte ikke å knytte vedlegg");
        else setPickerOpen(false);
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function linkExisting(documentId: string) {
    setError(null);
    startTransition(async () => {
      const res = await linkDocumentToMilestone(milestoneId, projectId, documentId);
      if (!res.ok) {
        setError(res.error || "Klarte ikke å knytte dokument");
        return;
      }
      setPickerOpen(false);
      setFilter("");
    });
  }

  const busy = uploading || pending;

  return (
    <div className="flex flex-col items-end gap-0.5">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
        onChange={onFile}
        className="hidden"
      />
      <button
        type="button"
        className="text-xs text-brand-700 hover:underline disabled:opacity-50"
        disabled={busy}
        onClick={() => setPickerOpen(true)}
      >
        {busy
          ? "Lagrer…"
          : hasFileLink || currentDocumentId
            ? "📎 Bytt / knytt vedlegg"
            : "📎 Knytt vedlegg"}
      </button>
      {error && <p className="text-[10px] text-red-600 max-w-[10rem] text-right">{error}</p>}

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-semibold text-sm">Knytt vedlegg til hendelse</h3>
                {currentDocumentTitle && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[16rem]">
                    Nå: {currentDocumentTitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  setFilter("");
                  setError(null);
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 border-b space-y-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="w-full text-sm rounded-lg border border-brand-200 bg-brand-50 text-brand-800 px-3 py-2 hover:bg-brand-100 disabled:opacity-50"
              >
                {uploading ? "Laster opp…" : "⬆ Last opp ny PDF / bilde"}
              </button>
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Søk i eksisterende dokumenter…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>

            <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {sortedDocs.length === 0 ? (
                <li className="p-4 text-sm text-slate-500">Ingen dokumenter å knytte.</li>
              ) : (
                sortedDocs.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => linkExisting(d.id)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <div className="font-medium text-sm truncate">
                        {d.public_url ? "📎 " : "📝 "}
                        {d.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {d.kind}
                        {d.public_url ? " · åpnbar fil" : " · kun tekst"}
                        {" · "}
                        {(d.source_date || d.created_at).slice(0, 10)}
                      </div>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
