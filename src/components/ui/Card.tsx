import type { HTMLAttributes } from "react";

type Variant = "default" | "muted" | "outline";

const variantClasses: Record<Variant, string> = {
  default: "bg-surface border border-line",
  muted: "bg-surface-muted border border-line",
  outline: "bg-surface border border-line-strong",
};

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
  padded?: boolean;
};

export function Card({
  variant = "default",
  padded = true,
  className = "",
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        "rounded-xl",
        variantClasses[variant],
        padded ? "p-5" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );
}
