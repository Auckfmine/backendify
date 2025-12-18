import { ComponentProps } from "react";

export function Button(props: ComponentProps<"button">) {
  const { className = "", ...rest } = props;
  return (
    <button
      className={`rounded-md px-3 py-2 text-sm font-semibold text-white bg-primary hover:bg-teal-700 transition ${className}`}
      {...rest}
    />
  );
}

export function Input(props: ComponentProps<"input">) {
  const { className = "", ...rest } = props;
  return (
    <input
      className={`w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${className}`}
      {...rest}
    />
  );
}

export function Card(props: ComponentProps<"div">) {
  const { className = "", ...rest } = props;
  return <div className={`rounded-xl border border-slate-200 bg-white/70 shadow-sm ${className}`} {...rest} />;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-slate-800">{children}</h2>;
}
