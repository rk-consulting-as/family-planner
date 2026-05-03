"use client";

import { useRef, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { addNeedComment } from "@/lib/actions/needs";

export default function CommentForm({ needId }: { needId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function handle(formData: FormData) {
    startTransition(async () => {
      await addNeedComment(needId, formData);
      ref.current?.reset();
    });
  }

  return (
    <form ref={ref} action={handle} className="flex items-end gap-2 pt-2 border-t border-slate-100">
      <div className="flex-1">
        <Textarea name="body" rows={2} placeholder="Skriv en kommentar eller still et spørsmål..." required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Sender…" : "Send"}
      </Button>
    </form>
  );
}
