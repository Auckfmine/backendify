import { ComponentProps, forwardRef } from "react";
import { clsx } from "clsx";

export interface InputProps extends ComponentProps<"input"> {
  error?: boolean;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={clsx(
            "w-full rounded-xl border bg-white/90 backdrop-blur-sm px-4 py-2.5 text-sm text-slate-900",
            "placeholder:text-slate-400",
            "shadow-sm shadow-slate-200/50",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400",
            "hover:border-slate-300",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50",
            error
              ? "border-rose-300 focus:ring-rose-500/40 focus:border-rose-400"
              : "border-slate-200",
            icon && "pl-10",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = "Input";
