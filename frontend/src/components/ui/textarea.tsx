import { ComponentProps, forwardRef } from "react";
import { clsx } from "clsx";

export interface TextareaProps extends ComponentProps<"textarea"> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={clsx(
          "w-full rounded-xl border bg-white/90 backdrop-blur-sm px-4 py-3 text-sm text-slate-900",
          "placeholder:text-slate-400",
          "shadow-sm shadow-slate-200/50",
          "transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400",
          "hover:border-slate-300",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50",
          "resize-none",
          error
            ? "border-rose-300 focus:ring-rose-500/40 focus:border-rose-400"
            : "border-slate-200",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
