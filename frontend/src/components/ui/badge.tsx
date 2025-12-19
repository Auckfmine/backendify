import { ComponentProps, forwardRef, ReactNode } from "react";
import { clsx } from "clsx";

export type BadgeTone =
  | "indigo"
  | "blue"
  | "emerald"
  | "amber"
  | "rose"
  | "purple"
  | "cyan"
  | "slate"
  | "green"
  | "red"
  | "yellow";

const toneStyles: Record<BadgeTone, string> = {
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200/80 ring-indigo-500/10",
  blue: "bg-blue-50 text-blue-700 border-blue-200/80 ring-blue-500/10",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200/80 ring-emerald-500/10",
  green: "bg-green-50 text-green-700 border-green-200/80 ring-green-500/10",
  amber: "bg-amber-50 text-amber-700 border-amber-200/80 ring-amber-500/10",
  yellow: "bg-yellow-50 text-yellow-700 border-yellow-200/80 ring-yellow-500/10",
  rose: "bg-rose-50 text-rose-700 border-rose-200/80 ring-rose-500/10",
  red: "bg-red-50 text-red-700 border-red-200/80 ring-red-500/10",
  purple: "bg-purple-50 text-purple-700 border-purple-200/80 ring-purple-500/10",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200/80 ring-cyan-500/10",
  slate: "bg-slate-100 text-slate-700 border-slate-200/80 ring-slate-500/10",
};

export interface BadgeProps extends ComponentProps<"span"> {
  tone?: BadgeTone;
  icon?: ReactNode;
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone = "indigo", icon, dot, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
          "ring-1 ring-inset",
          "transition-colors duration-150",
          toneStyles[tone],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={clsx(
              "h-1.5 w-1.5 rounded-full",
              tone === "emerald" || tone === "green"
                ? "bg-emerald-500"
                : tone === "rose" || tone === "red"
                ? "bg-rose-500"
                : tone === "amber" || tone === "yellow"
                ? "bg-amber-500"
                : "bg-current"
            )}
          />
        )}
        {icon && <span className="shrink-0 -ml-0.5">{icon}</span>}
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

export type Tone = BadgeTone;
