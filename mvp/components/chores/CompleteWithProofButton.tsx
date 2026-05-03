"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { completeChore, completeChoreWithProof } from "@/lib/actions/chores";

export default function CompleteWithProofButton({ assignmentId }: { assignmentId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNoProof() {
    startTransition(async () => {
      await completeChore(assignmentId);
      setOpen(false);
    });
  }

  async function handleWithProof(file: File) {
    setError(null);
    if (file.size > 8 * 1024 * 1024) {
      setError("Bildet er for stort (maks 8 MB)");
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
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/chores/${assignmentId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("attachments")
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        setError("Opplasting feilet: " + upErr.message);
        return;
      }
      const { data: pub } = supabase.storage.from("attachments").getPublicUrl(path);
      startTransition(async () => {
        await completeChoreWithProof(assignmentId, pub.publicUrl);
        setOpen(false);
      });
    } finally {
      setUploading(false);
    }
  }

  if (!open) {
    return <Button size="sm" onClick={() => setOpen(true)}>Marker ferdig</Button>;
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleWithProof(f);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || pending}
        >
          {uploading ? "Laster…" : "📷 Ta bilde / velg"}
        </Button>
        <Button size="sm" onClick={handleNoProof} disabled={uploading || pending}>
          Bare merk ferdig
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Avbryt
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
