import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Mail, Lock, ArrowRight, UserPlus } from "lucide-react";

import { register } from "../lib/api";
import { AuthShell } from "../components/AuthShell";
import { Button, FormField, Input } from "../components/ui";

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => register(email, password),
    onSuccess: () => {
      navigate({ to: "/" });
    },
    onError: (err: Error) => setError(err.message || "Unable to register"),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  return (
    <AuthShell
      eyebrow="Register"
      title="Create your account"
      subtitle="Get started with Backendify in seconds."
      sideTitle="Start building today."
      sideDescription="Create an account to orchestrate projects, API keys, authentication, and observability from one powerful dashboard."
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
        <FormField label="Password" hint="Minimum 8 characters">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a strong password"
            icon={<Lock className="h-4 w-4" />}
            minLength={8}
            required
          />
        </FormField>
        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        <Button type="submit" className="w-full" loading={mutation.isPending}>
          Create account
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
      <div className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link to="/login" search={{}} className="font-semibold text-indigo-600 hover:text-indigo-500">
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}
