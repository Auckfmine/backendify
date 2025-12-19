import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Shield, Database, Key, Activity, ArrowRight } from "lucide-react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  sideTitle: string;
  sideDescription: string;
  highlights?: string[];
  children: ReactNode;
};

const features = [
  { icon: Shield, label: "Secure Auth", description: "JWT + refresh rotation" },
  { icon: Database, label: "Schema Builder", description: "Visual data modeling" },
  { icon: Key, label: "API Keys", description: "Scoped & revocable" },
  { icon: Activity, label: "Audit Trails", description: "Full observability" },
];

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  sideTitle,
  sideDescription,
  children,
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        {/* Left panel - branding */}
        <div className="hidden w-1/2 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 lg:flex lg:flex-col">
          <div className="flex flex-1 flex-col justify-between p-12">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 text-lg font-bold text-white shadow-lg shadow-indigo-500/30">
                B
              </div>
              <div>
                <p className="text-lg font-bold text-white">Backendify</p>
                <p className="text-xs text-indigo-300">Backend as a Service</p>
              </div>
            </div>

            {/* Main content */}
            <div className="max-w-md space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
                  {sideTitle}
                </h1>
                <p className="text-lg text-indigo-200/80">{sideDescription}</p>
              </div>

              {/* Feature grid */}
              <div className="grid grid-cols-2 gap-4">
                {features.map((feature) => (
                  <div
                    key={feature.label}
                    className="group rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-colors hover:bg-white/10"
                  >
                    <feature.icon className="h-5 w-5 text-indigo-400" />
                    <p className="mt-2 font-medium text-white">{feature.label}</p>
                    <p className="text-sm text-indigo-300/70">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-6 text-sm text-indigo-300/60">
              <span>Secure by design</span>
              <span className="h-1 w-1 rounded-full bg-indigo-500" />
              <span>Multi-tenant ready</span>
              <span className="h-1 w-1 rounded-full bg-indigo-500" />
              <span>Open source</span>
            </div>
          </div>
        </div>

        {/* Right panel - form */}
        <div className="flex flex-1 flex-col">
          {/* Mobile header */}
          <div className="flex items-center justify-between border-b border-slate-200 p-4 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-blue-500 text-sm font-bold text-white">
                B
              </div>
              <span className="font-semibold text-slate-900">Backendify</span>
            </div>
          </div>

          {/* Form container */}
          <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
            <div className="w-full max-w-md">
              {/* Header */}
              <div className="mb-8">
                <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">
                  {eyebrow}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">{title}</h2>
                <p className="mt-1 text-slate-500">{subtitle}</p>
              </div>

              {/* Form content */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50">
                {children}
              </div>

              {/* Help text */}
              <p className="mt-6 text-center text-sm text-slate-500">
                By continuing, you agree to our{" "}
                <a href="#" className="font-medium text-indigo-600 hover:text-indigo-500">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="font-medium text-indigo-600 hover:text-indigo-500">
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
