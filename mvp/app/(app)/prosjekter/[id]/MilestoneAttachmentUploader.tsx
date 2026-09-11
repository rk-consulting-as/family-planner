"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { attachFileToMilestone } from "@/lib/actions/projects";

export default function MilestoneAttachmentUploader({
  milestoneId,
  projectId,
  hasFileLink = false,
}: {
  milestoneId: string;
  projectId: string;
  hasFileLink?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

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
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? "Laster opp…" : hasFileLink ? "📎 Bytt vedlegg" : "📎 Last opp vedlegg"}
      </button>
      {error && <p className="text-[10px] text-red-600 max-w-[9rem] text-right">{error}</p>}
    </div>
  );
}
