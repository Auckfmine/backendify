import { ReactNode } from "react";
import { clsx } from "clsx";

export interface SectionTitleProps {
  children: ReactNode;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionTitle({
  children,
  description,
  action,
  className,
}: SectionTitleProps) {
  return (
    <div className={clsx("flex items-start justify-between gap-4", className)}>
      <div>
        <h2 className="text-base font-semibold text-slate-900 tracking-tight">
          {children}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
