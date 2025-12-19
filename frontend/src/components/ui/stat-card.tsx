import { ReactNode } from "react";
import { clsx } from "clsx";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { BadgeTone } from "./badge";

const toneGradients: Record<BadgeTone, string> = {
  indigo: "from-indigo-500/10 via-indigo-400/5 to-transparent",
  blue: "from-blue-500/10 via-blue-400/5 to-transparent",
  emerald: "from-emerald-500/10 via-emerald-400/5 to-transparent",
  green: "from-green-500/10 via-green-400/5 to-transparent",
  amber: "from-amber-500/10 via-amber-400/5 to-transparent",
  yellow: "from-yellow-500/10 via-yellow-400/5 to-transparent",
  rose: "from-rose-500/10 via-rose-400/5 to-transparent",
  red: "from-red-500/10 via-red-400/5 to-transparent",
  purple: "from-purple-500/10 via-purple-400/5 to-transparent",
  cyan: "from-cyan-500/10 via-cyan-400/5 to-transparent",
  slate: "from-slate-500/10 via-slate-400/5 to-transparent",
};

const toneIconBg: Record<BadgeTone, string> = {
  indigo: "bg-indigo-100 text-indigo-600",
  blue: "bg-blue-100 text-blue-600",
  emerald: "bg-emerald-100 text-emerald-600",
  green: "bg-green-100 text-green-600",
  amber: "bg-amber-100 text-amber-600",
  yellow: "bg-yellow-100 text-yellow-600",
  rose: "bg-rose-100 text-rose-600",
  red: "bg-red-100 text-red-600",
  purple: "bg-purple-100 text-purple-600",
  cyan: "bg-cyan-100 text-cyan-600",
  slate: "bg-slate-100 text-slate-600",
};

export interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: BadgeTone;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export function StatCard({
  label,
  value,
  hint,
  tone = "indigo",
  icon,
  trend,
  trendValue,
}: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300/80">
      <div
        className={clsx(
          "absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br opacity-60 blur-2xl transition-opacity group-hover:opacity-80",
          toneGradients[tone]
        )}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {label}
            </p>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
          </div>
          {icon && (
            <div
              className={clsx(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                toneIconBg[tone]
              )}
            >
              {icon}
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {trend && (
            <span
              className={clsx(
                "inline-flex items-center gap-1 text-xs font-semibold",
                trend === "up" && "text-emerald-600",
                trend === "down" && "text-rose-600",
                trend === "neutral" && "text-slate-500"
              )}
            >
              {trend === "up" && <TrendingUp className="h-3.5 w-3.5" />}
              {trend === "down" && <TrendingDown className="h-3.5 w-3.5" />}
              {trend === "neutral" && <Minus className="h-3.5 w-3.5" />}
              {trendValue}
            </span>
          )}
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
