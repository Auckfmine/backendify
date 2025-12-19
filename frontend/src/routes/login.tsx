import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Mail, Lock, ArrowRight } from "lucide-react";

import { login } from "../lib/api";
import { AuthShell } from "../components/AuthShell";
import { Button, FormField, Input } from "../components/ui";

export function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: () => {
      navigate({ to: search?.redirect || "/" });
    },
    onError: () => setError("Invalid credentials"),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  return (
    <AuthShell
      eyebrow="Login"
      title="Welcome back"
      subtitle="Sign in to your Backendify account."
      sideTitle="Build backends faster than ever."
      sideDescription="Manage projects, schemas, users, and automation from a focused cockpit designed for developer productivity."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            icon={<Mail className="h-4 w-4" />}
            required
          />
        </FormField>
        <FormField label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            icon={<Lock className="h-4 w-4" />}
            required
          />
        </FormField>
        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        <Button type="submit" className="w-full" loading={mutation.isPending}>
          Sign in
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
      <div className="mt-6 text-center text-sm text-slate-600">
        Don't have an account?{" "}
        <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-500">
          Create one
        </Link>
      </div>
    </AuthShell>
  );
}
