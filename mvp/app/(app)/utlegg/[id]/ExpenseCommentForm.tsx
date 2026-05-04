"use client";

import { useRef, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { addExpenseComment } from "@/lib/actions/expenses";

export default function ExpenseCommentForm({ expenseId }: { expenseId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function handle(formData: FormData) {
    startTransition(async () => {
      await addExpenseComment(expenseId, formData);
      ref.current?.reset();
    });
  }

  return (
    <form
      ref={ref}
      action={handle}
      className="flex items-end gap-2 pt-2 border-t border-slate-100"
    >
      <div className="flex-1">
        <Textarea
          name="body"
          rows={2}
          placeholder="Skriv en kommentar..."
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Sender…" : "Send"}
      </Button>
    </form>
  );
}
