import { ReactNode } from "react";
import { clsx } from "clsx";

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  badges?: ReactNode;
  icon?: ReactNode;
  variant?: "default" | "gradient" | "minimal";
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  badges,
  icon,
  variant = "gradient",
}: PageHeaderProps) {
  if (variant === "minimal") {
    return (
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              {eyebrow}
            </p>
          )}
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                {icon}
              </div>
            )}
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          </div>
          {description && (
            <p className="text-sm text-slate-500 max-w-2xl">{description}</p>
          )}
          {badges && <div className="flex flex-wrap gap-2 mt-2">{badges}</div>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-2xl border px-6 py-8 shadow-xl",
        variant === "gradient"
          ? "border-slate-800/50 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-900"
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute right-1/4 top-1/2 h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl" />
      </div>

      <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          {eyebrow && (
            <p
              className={clsx(
                "text-xs font-semibold uppercase tracking-[0.2em]",
                variant === "gradient" ? "text-indigo-300" : "text-indigo-600"
              )}
            >
              {eyebrow}
            </p>
          )}
          <div className="flex items-center gap-4">
            {icon && (
              <div
                className={clsx(
                  "flex h-12 w-12 items-center justify-center rounded-xl",
                  variant === "gradient"
                    ? "bg-white/10 text-white backdrop-blur-sm"
                    : "bg-indigo-100 text-indigo-600"
                )}
              >
                {icon}
              </div>
            )}
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          </div>
          {description && (
            <p
              className={clsx(
                "max-w-2xl text-sm",
                variant === "gradient" ? "text-indigo-100" : "text-slate-500"
              )}
            >
              {description}
            </p>
          )}
          {badges && <div className="flex flex-wrap gap-2">{badges}</div>}
        </div>
        {actions && <div className="flex flex-col gap-2 sm:flex-row">{actions}</div>}
      </div>
    </div>
  );
}
