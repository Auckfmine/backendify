import { ReactNode } from "react";
import { clsx } from "clsx";

export interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  hint,
  error,
  required,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={clsx("space-y-1.5", className)}>
      <label className="flex items-center gap-1 text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
