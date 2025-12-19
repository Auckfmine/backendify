import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { ArrowUpRight } from "lucide-react";
import type { BadgeTone } from "./badge";

const toneStyles: Record<BadgeTone, { bg: string; border: string; icon: string }> = {
  indigo: {
    bg: "group-hover:bg-indigo-50",
    border: "group-hover:border-indigo-200",
    icon: "bg-indigo-100 text-indigo-600 group-hover:bg-indigo-200",
  },
  blue: {
    bg: "group-hover:bg-blue-50",
    border: "group-hover:border-blue-200",
    icon: "bg-blue-100 text-blue-600 group-hover:bg-blue-200",
  },
  emerald: {
    bg: "group-hover:bg-emerald-50",
    border: "group-hover:border-emerald-200",
    icon: "bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200",
  },
  green: {
    bg: "group-hover:bg-green-50",
    border: "group-hover:border-green-200",
    icon: "bg-green-100 text-green-600 group-hover:bg-green-200",
  },
  amber: {
    bg: "group-hover:bg-amber-50",
    border: "group-hover:border-amber-200",
    icon: "bg-amber-100 text-amber-600 group-hover:bg-amber-200",
  },
  yellow: {
    bg: "group-hover:bg-yellow-50",
    border: "group-hover:border-yellow-200",
    icon: "bg-yellow-100 text-yellow-600 group-hover:bg-yellow-200",
  },
  rose: {
    bg: "group-hover:bg-rose-50",
    border: "group-hover:border-rose-200",
    icon: "bg-rose-100 text-rose-600 group-hover:bg-rose-200",
  },
  red: {
    bg: "group-hover:bg-red-50",
    border: "group-hover:border-red-200",
    icon: "bg-red-100 text-red-600 group-hover:bg-red-200",
  },
  purple: {
    bg: "group-hover:bg-purple-50",
    border: "group-hover:border-purple-200",
    icon: "bg-purple-100 text-purple-600 group-hover:bg-purple-200",
  },
  cyan: {
    bg: "group-hover:bg-cyan-50",
    border: "group-hover:border-cyan-200",
    icon: "bg-cyan-100 text-cyan-600 group-hover:bg-cyan-200",
  },
  slate: {
    bg: "group-hover:bg-slate-50",
    border: "group-hover:border-slate-300",
    icon: "bg-slate-100 text-slate-600 group-hover:bg-slate-200",
  },
};

export interface NavCardProps {
  title: string;
  description?: string;
  to: string;
  params?: Record<string, string>;
  tone?: BadgeTone;
  meta?: string;
  icon?: ReactNode;
}

export function NavCard({
  title,
  description,
  to,
  params,
  tone = "indigo",
  meta,
  icon,
}: NavCardProps) {
  const styles = toneStyles[tone];

  return (
    <Link
      to={to}
      params={params}
      className={clsx(
        "group relative flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/50",
        styles.bg,
        styles.border
      )}
    >
      {icon && (
        <div
          className={clsx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
            styles.icon
          )}
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-slate-900 truncate">{title}</p>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-slate-600" />
        </div>
        {description && (
          <p className="mt-0.5 text-sm text-slate-500 line-clamp-2">{description}</p>
        )}
        {meta && (
          <p className="mt-1.5 text-xs text-slate-400 font-mono truncate">{meta}</p>
        )}
      </div>
    </Link>
  );
}
