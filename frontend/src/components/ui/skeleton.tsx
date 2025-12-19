import { clsx } from "clsx";

export interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className,
  variant = "text",
  width,
  height,
}: SkeletonProps) {
  return (
    <div
      className={clsx(
        "animate-pulse bg-slate-200",
        variant === "text" && "h-4 rounded",
        variant === "circular" && "rounded-full",
        variant === "rectangular" && "rounded-lg",
        className
      )}
      style={{ width, height }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={12} />
        </div>
      </div>
      <Skeleton height={12} />
      <Skeleton width="80%" height={12} />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 px-4 py-3">
        <Skeleton width="20%" height={14} />
        <Skeleton width="30%" height={14} />
        <Skeleton width="25%" height={14} />
        <Skeleton width="15%" height={14} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-t border-slate-100">
          <Skeleton width="20%" height={16} />
          <Skeleton width="30%" height={16} />
          <Skeleton width="25%" height={16} />
          <Skeleton width="15%" height={16} />
        </div>
      ))}
    </div>
  );
}
