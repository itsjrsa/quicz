import { forwardRef, type InputHTMLAttributes } from "react";

type Size = "md" | "lg";

const sizeClasses: Record<Size, string> = {
  md: "px-3 py-2 text-sm rounded-md",
  lg: "px-4 py-4 text-lg rounded-xl",
};

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  fieldSize?: Size;
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { fieldSize = "md", invalid, className = "", ...rest },
  ref
) {
  const classes = [
    "w-full border bg-surface text-ink placeholder:text-ink-faint",
    "focus-visible:outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/10",
    "disabled:bg-surface-muted disabled:text-ink-faint",
    invalid ? "border-danger" : "border-line",
    sizeClasses[fieldSize],
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <input ref={ref} className={classes} {...rest} />;
});
