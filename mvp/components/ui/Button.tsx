import * as React from "react";
import { cn } from "@/lib/utils";

// Kinship & Co-stil: solid primary med hover-brightness, soft press-animation.

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "tonal" | "outline";
  size?: "sm" | "md" | "lg";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 font-label-lg font-bold rounded-full transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary disabled:opacity-50 disabled:pointer-events-none";
    const variants = {
      primary: "bg-primary text-on-primary hover:brightness-110 shadow-soft",
      secondary: "bg-secondary text-on-secondary hover:brightness-110",
      tonal: "bg-primary-container text-on-primary-container hover:bg-primary-container/80",
      outline:
        "border-2 border-secondary text-secondary hover:bg-secondary-container/30",
      ghost: "text-on-surface-variant hover:bg-surface-container-low",
      destructive: "bg-error text-on-error hover:brightness-110",
    };
    const sizes = {
      sm: "h-9 px-4 text-label-lg",
      md: "h-11 px-md text-label-lg",
      lg: "h-12 px-md text-body-md",
    };
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
