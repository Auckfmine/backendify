import { clsx } from "clsx";

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getColorFromString(str: string): string {
  const colors = [
    "bg-indigo-500",
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-purple-500",
    "bg-cyan-500",
    "bg-pink-500",
    "bg-teal-500",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({
  src,
  alt = "",
  fallback,
  size = "md",
  className,
}: AvatarProps) {
  const initials = fallback ? getInitials(fallback) : alt ? getInitials(alt) : "?";
  const bgColor = getColorFromString(fallback || alt || "default");

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={clsx(
          "rounded-full object-cover ring-2 ring-white",
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={clsx(
        "flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-white",
        sizeClasses[size],
        bgColor,
        className
      )}
    >
      {initials}
    </div>
  );
}

export interface AvatarGroupProps {
  children: React.ReactNode;
  max?: number;
}

export function AvatarGroup({ children, max = 4 }: AvatarGroupProps) {
  const childArray = Array.isArray(children) ? children : [children];
  const visible = childArray.slice(0, max);
  const remaining = childArray.length - max;

  return (
    <div className="flex -space-x-2">
      {visible}
      {remaining > 0 && (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600 ring-2 ring-white">
          +{remaining}
        </div>
      )}
    </div>
  );
}
