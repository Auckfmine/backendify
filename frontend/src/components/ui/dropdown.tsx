import { ReactNode, useState, useRef, useEffect } from "react";
import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";

export interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
}

export function Dropdown({ trigger, children, align = "left" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          className={clsx(
            "absolute z-50 mt-2 min-w-[180px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/50",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export interface DropdownItemProps {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

export function DropdownItem({
  children,
  onClick,
  icon,
  danger,
  disabled,
}: DropdownItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        danger
          ? "text-rose-600 hover:bg-rose-50"
          : "text-slate-700 hover:bg-slate-50"
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

export interface DropdownSeparatorProps {}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-slate-200" />;
}

export interface DropdownLabelProps {
  children: ReactNode;
}

export function DropdownLabel({ children }: DropdownLabelProps) {
  return (
    <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </div>
  );
}
