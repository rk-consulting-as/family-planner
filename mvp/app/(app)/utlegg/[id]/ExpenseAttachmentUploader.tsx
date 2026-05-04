"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { recordExpenseAttachment } from "@/lib/actions/expenses";

export default function ExpenseAttachmentUploader({ expenseId }: { expenseId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    if (file.size > 8 * 1024 * 1024) {
      setErr("Filen er for stor (maks 8 MB)");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setErr("Ikke innlogget");
        return;
      }
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `${user.id}/expenses/${expenseId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("attachments")
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        setErr("Opplasting feilet: " + upErr.message);
        return;
      }
      const { data: pub } = supabase.storage.from("attachments").getPublicUrl(path);
      startTransition(async () => {
        await recordExpenseAttachment(
          expenseId,
          path,
          pub.publicUrl,
          file.name,
          file.type,
          file.size
        );
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,application/pdf"
        capture="environment"
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
        {uploading ? "Laster opp…" : "📷 Legg til kvittering"}
      </Button>
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  );
}
