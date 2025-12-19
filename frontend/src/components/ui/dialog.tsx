import { Fragment, ReactNode } from "react";
import { clsx } from "clsx";
import { X } from "lucide-react";
import { Button } from "./button";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({ open, onClose, children }: DialogProps) {
  if (!open) return null;

  return (
    <Fragment>
      <div
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={clsx(
            "relative w-full max-w-lg rounded-2xl bg-white shadow-2xl shadow-slate-900/20",
            "animate-in fade-in-0 zoom-in-95 duration-200"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </Fragment>
  );
}

export interface DialogHeaderProps {
  children: ReactNode;
  onClose?: () => void;
}

export function DialogHeader({ children, onClose }: DialogHeaderProps) {
  return (
    <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
      <div>{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

export interface DialogTitleProps {
  children: ReactNode;
}

export function DialogTitle({ children }: DialogTitleProps) {
  return <h2 className="text-lg font-semibold text-slate-900">{children}</h2>;
}

export interface DialogDescriptionProps {
  children: ReactNode;
}

export function DialogDescription({ children }: DialogDescriptionProps) {
  return <p className="mt-1 text-sm text-slate-500">{children}</p>;
}

export interface DialogContentProps {
  children: ReactNode;
  className?: string;
}

export function DialogContent({ children, className }: DialogContentProps) {
  return <div className={clsx("px-6 py-4", className)}>{children}</div>;
}

export interface DialogFooterProps {
  children: ReactNode;
}

export function DialogFooter({ children }: DialogFooterProps) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
      {children}
    </div>
  );
}
