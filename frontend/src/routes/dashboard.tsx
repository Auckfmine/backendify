import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import {
  FolderKanban,
  Shield,
  Zap,
  Activity,
  Plus,
  RefreshCw,
  ArrowRight,
} from "lucide-react";

import { createProject, fetchProjects, Project } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import {
  Badge,
  Button,
  Card,
  FormField,
  Input,
  NavCard,
  PageHeader,
  SectionTitle,
  StatCard,
  EmptyState,
} from "../components/ui";

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { data: projects, isLoading } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: fetchProjects,
  });
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: () => createProject(name),
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Control Center"
        title="Welcome to Backendify"
        description="Build, observe, and evolve your backend. Create projects, design schemas, issue API keys, and monitor everything from one dashboard."
        variant="gradient"
        badges={
          <>
            <Badge tone="indigo" dot>Schema-first</Badge>
            <Badge tone="emerald" dot>Audit ready</Badge>
            <Badge tone="amber" dot>Multi-tenant</Badge>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Projects"
          value={projects?.length ?? 0}
          hint="Active workspaces"
          tone="indigo"
          icon={<FolderKanban className="h-5 w-5" />}
        />
        <StatCard
          label="Auth Status"
          value="Online"
          hint="JWT + refresh rotation"
          tone="emerald"
          icon={<Shield className="h-5 w-5" />}
        />
        <StatCard
          label="API Status"
          value="Ready"
          hint="Admin + app endpoints"
          tone="blue"
          icon={<Zap className="h-5 w-5" />}
        />
        <StatCard
          label="Observability"
          value="Active"
          hint="Logs and webhooks"
          tone="amber"
          icon={<Activity className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" padding="md">
          <SectionTitle
            description="Select a project to manage its schema, data, and settings"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.projects })}
                icon={<RefreshCw className="h-4 w-4" />}
              >
                Refresh
              </Button>
            }
          >
            Your Projects
          </SectionTitle>

          <div className="mt-6">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : projects?.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {projects.map((project: Project) => (
                  <NavCard
                    key={project.id}
                    title={project.name}
                    description="Project workspace"
                    to="/projects/$projectId"
                    params={{ projectId: project.id }}
                    meta={project.id.slice(0, 8) + "..."}
                    tone="indigo"
                    icon={<FolderKanban className="h-5 w-5" />}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<FolderKanban className="h-7 w-7" />}
                title="No projects yet"
                description="Create your first project to get started with Backendify"
              />
            )}
          </div>
        </Card>

        <Card padding="md">
          <SectionTitle
            description="Spin up a new workspace"
            action={
              <Badge tone="emerald" dot>
                Instant
              </Badge>
            }
          >
            Create Project
          </SectionTitle>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <FormField label="Project name" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-awesome-project"
                required
              />
            </FormField>
            <Button
              type="submit"
              className="w-full"
              loading={mutation.isPending}
              icon={<Plus className="h-4 w-4" />}
            >
              Create Project
            </Button>
          </form>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">What you get:</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-500">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Isolated database schema
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                API keys & authentication
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Audit logs & webhooks
              </li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
