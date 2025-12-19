import { ComponentProps, forwardRef } from "react";
import { clsx } from "clsx";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:from-indigo-500 hover:via-indigo-400 hover:to-blue-400 border-0",
  secondary:
    "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 shadow-sm",
  ghost:
    "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-0",
  danger:
    "bg-gradient-to-r from-rose-600 to-red-500 text-white shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 border-0",
  outline:
    "bg-white/80 text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2.5 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2.5",
};

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      icon,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
          "transform active:scale-[0.98]",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
