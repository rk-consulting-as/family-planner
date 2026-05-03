"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { recordNeedAttachment } from "@/lib/actions/needs";

export default function AttachmentUploader({
  needId,
  canUpload = true,
}: {
  needId: string;
  canUpload?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > 8 * 1024 * 1024) {
      setError("Filen er for stor (maks 8 MB)");
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
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `${user.id}/needs/${needId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("attachments")
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        setError("Opplasting feilet: " + upErr.message);
        return;
      }
      const { data: pub } = supabase.storage.from("attachments").getPublicUrl(path);
      startTransition(async () => {
        await recordNeedAttachment(needId, path, pub.publicUrl, file.name, file.type, file.size);
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!canUpload) return null;

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
        onChange={onFile}
        className="hidden"
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? "Laster opp…" : "📎 Legg til vedlegg"}
      </Button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
