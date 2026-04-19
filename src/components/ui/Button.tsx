import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-ink-strong text-surface hover:bg-ink disabled:bg-ink-faint disabled:text-surface",
  secondary:
    "border border-line text-ink hover:bg-surface-muted disabled:text-ink-faint disabled:bg-surface",
  ghost:
    "text-ink-muted hover:text-ink hover:bg-surface-muted disabled:text-ink-faint",
  danger:
    "border border-danger/30 text-danger hover:bg-danger-soft disabled:opacity-50",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-md",
  md: "px-4 py-2.5 text-sm rounded-lg",
  lg: "px-5 py-4 text-lg rounded-xl",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 " +
  "disabled:cursor-not-allowed";

export function buttonClass(
  variant: Variant = "primary",
  size: Size = "md",
  extra = ""
) {
  return [baseClasses, variantClasses[variant], sizeClasses[size], extra]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", fullWidth, className = "", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={buttonClass(variant, size, [fullWidth ? "w-full" : "", className].filter(Boolean).join(" "))}
      {...rest}
    />
  );
});
