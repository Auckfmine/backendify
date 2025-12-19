import { ComponentProps, forwardRef } from "react";
import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";

export interface SelectProps extends ComponentProps<"select"> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={clsx(
            "w-full appearance-none rounded-xl border bg-white/90 backdrop-blur-sm px-4 py-2.5 pr-10 text-sm text-slate-900",
            "shadow-sm shadow-slate-200/50",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400",
            "hover:border-slate-300",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50",
            error
              ? "border-rose-300 focus:ring-rose-500/40 focus:border-rose-400"
              : "border-slate-200",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    );
  }
);

Select.displayName = "Select";
