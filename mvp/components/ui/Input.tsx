import * as React from "react";
import { cn } from "@/lib/utils";

// Kinship & Co-stil: filled-bakgrunn, ingen border. På fokus: hvit + primary border.

const inputBase =
  "flex w-full rounded-lg bg-surface-container-low border-2 border-transparent px-3 text-body-md text-on-surface " +
  "placeholder:text-on-surface-variant/60 " +
  "focus-visible:outline-none focus-visible:bg-surface-container-lowest focus-visible:border-primary " +
  "disabled:opacity-50 transition-all";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(inputBase, "h-11", className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(inputBase, "min-h-[88px] py-2.5", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(inputBase, "h-11", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block text-label-lg font-bold text-on-surface mb-1.5",
        className
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label && <Label>{label}</Label>}
      {children}
      {hint && !error && <p className="text-label-sm text-on-surface-variant">{hint}</p>}
      {error && <p className="text-label-sm text-error">{error}</p>}
    </div>
  );
}
