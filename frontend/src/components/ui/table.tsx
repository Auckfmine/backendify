import { ComponentProps, forwardRef } from "react";
import { clsx } from "clsx";

export const Table = forwardRef<HTMLTableElement, ComponentProps<"table">>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto rounded-xl border border-slate-200">
      <table
        ref={ref}
        className={clsx("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
);
Table.displayName = "Table";

export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  ComponentProps<"thead">
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={clsx("bg-slate-50/80 [&_tr]:border-b", className)}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  ComponentProps<"tbody">
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={clsx("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

export const TableFooter = forwardRef<
  HTMLTableSectionElement,
  ComponentProps<"tfoot">
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={clsx(
      "border-t bg-slate-50/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

export const TableRow = forwardRef<HTMLTableRowElement, ComponentProps<"tr">>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={clsx(
        "border-b border-slate-200 transition-colors hover:bg-slate-50/50 data-[state=selected]:bg-slate-100",
        className
      )}
      {...props}
    />
  )
);
TableRow.displayName = "TableRow";

export const TableHead = forwardRef<
  HTMLTableCellElement,
  ComponentProps<"th">
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={clsx(
      "h-11 px-4 text-left align-middle font-semibold text-slate-600 [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

export const TableCell = forwardRef<
  HTMLTableCellElement,
  ComponentProps<"td">
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={clsx(
      "px-4 py-3 align-middle text-slate-700 [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

export const TableCaption = forwardRef<
  HTMLTableCaptionElement,
  ComponentProps<"caption">
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={clsx("mt-4 text-sm text-slate-500", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";
