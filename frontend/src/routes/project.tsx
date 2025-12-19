import { useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import {
  Database,
  Table2,
  ScrollText,
  Webhook,
  GitBranch,
  Shield,
  RefreshCw,
  Link2,
  Eye,
  CheckSquare,
  FileBox,
  KeyRound,
  Plus,
  Key,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";

import {
  createApiKey,
  fetchApiKeys,
  fetchProject,
  revokeApiKey,
  ApiKey,
} from "../lib/api";
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
  EmptyState,
} from "../components/ui";
import type { BadgeTone } from "../components/ui/badge";

export function ProjectPage() {
  const params = useRouterState({ select: (s) => s.matches.at(-1)?.params }) as { projectId: string } | undefined;
  const projectId = params?.projectId ?? "";
  const queryClient = useQueryClient();
  const { data: project } = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => fetchProject(projectId),
  });
  const { data: apiKeys } = useQuery({
    queryKey: queryKeys.apiKeys(projectId),
    queryFn: () => fetchApiKeys(projectId),
  });

  const [keyName, setKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const createKeyMutation = useMutation({
    mutationFn: () => createApiKey(projectId, keyName || "Default key"),
    onSuccess: (data) => {
      setCreatedKey(data.api_key);
      setKeyName("");
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys(projectId) });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (apiKeyId: string) => revokeApiKey(projectId, apiKeyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys(projectId) }),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createKeyMutation.mutate();
  };

  const navigationCards: Array<{
    title: string;
    description: string;
    to: string;
    tone: BadgeTone;
    icon: React.ReactNode;
  }> = [
    {
      title: "Schema Builder",
      description: "Collections, fields, validation, indexes",
      to: "/projects/$projectId/schema",
      tone: "indigo",
      icon: <Database className="h-5 w-5" />,
    },
    {
      title: "Data Explorer",
      description: "Inspect and mutate records safely",
      to: "/projects/$projectId/data",
      tone: "emerald",
      icon: <Table2 className="h-5 w-5" />,
    },
    {
      title: "Audit Trails",
      description: "Security events, mutations, access",
      to: "/projects/$projectId/logs",
      tone: "amber",
      icon: <ScrollText className="h-5 w-5" />,
    },
    {
      title: "Webhooks",
      description: "Notify external systems on change",
      to: "/projects/$projectId/webhooks",
      tone: "cyan",
      icon: <Webhook className="h-5 w-5" />,
    },
    {
      title: "Workflows",
      description: "Orchestrate background tasks",
      to: "/projects/$projectId/workflows",
      tone: "emerald",
      icon: <GitBranch className="h-5 w-5" />,
    },
    {
      title: "Policies",
      description: "Guardrails, auth rules, and roles",
      to: "/projects/$projectId/policies",
      tone: "purple",
      icon: <Shield className="h-5 w-5" />,
    },
    {
      title: "Schema Evolution",
      description: "Iterate safely with migrations",
      to: "/projects/$projectId/schema-evolution",
      tone: "amber",
      icon: <RefreshCw className="h-5 w-5" />,
    },
    {
      title: "Relations",
      description: "Model links across collections",
      to: "/projects/$projectId/relations",
      tone: "cyan",
      icon: <Link2 className="h-5 w-5" />,
    },
    {
      title: "Views",
      description: "Read-optimized projections",
      to: "/projects/$projectId/views",
      tone: "blue",
      icon: <Eye className="h-5 w-5" />,
    },
    {
      title: "Validations",
      description: "Data quality and constraints",
      to: "/projects/$projectId/validations",
      tone: "rose",
      icon: <CheckSquare className="h-5 w-5" />,
    },
    {
      title: "Files",
      description: "Storage and asset delivery",
      to: "/projects/$projectId/files",
      tone: "slate",
      icon: <FileBox className="h-5 w-5" />,
    },
    {
      title: "App Auth",
      description: "User auth, providers, sessions",
      to: "/projects/$projectId/auth",
      tone: "rose",
      icon: <KeyRound className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Project"
        title={project?.name ?? "Project"}
        description={project?.id}
        badges={
          <>
            <Badge tone="indigo">API-first</Badge>
            <Badge tone="emerald">Schema-driven</Badge>
            <Badge tone="amber">Audit on</Badge>
          </>
        }
        actions={
          <Badge tone="emerald">
            Live
          </Badge>
        }
      />

      <Card className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionTitle>Project surfaces</SectionTitle>
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-semibold text-indigo-700">
            {navigationCards.length} modules
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {navigationCards.map((item) => (
            <NavCard
              key={item.title}
              title={item.title}
              description={item.description}
              to={item.to}
              params={{ projectId }}
              tone={item.tone}
              icon={item.icon}
            />
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-1">
          <div className="flex items-center justify-between">
            <SectionTitle>Create API key</SectionTitle>
            <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">secure</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Keys are hashed and shown once. Use per service for better observability.
          </p>
          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <FormField label="API key name">
              <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="API key name" />
            </FormField>
            <Button type="submit" className="w-full">
              {createKeyMutation.isPending ? "Creating..." : "Create key"}
            </Button>
          </form>
          {createdKey ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-semibold text-amber-800">Copy your API key now</p>
              <code className="mt-1 block break-all text-amber-900">{createdKey}</code>
              <p className="mt-1 text-[11px] text-amber-700">You will not be able to see it again.</p>
            </div>
          ) : null}
        </Card>

        <Card className="p-6 lg:col-span-2">
          <SectionTitle>API Keys</SectionTitle>
          <div className="mt-4 space-y-3">
            {(apiKeys || []).map((key: ApiKey) => (
              <div
                key={key.id}
                className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-indigo-600/10 text-indigo-700 flex items-center justify-center text-xs font-semibold">
                      {key.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{key.name}</div>
                      <div className="text-[11px] text-slate-500">Prefix: {key.prefix}</div>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">Created: {new Date(key.created_at).toLocaleString()}</div>
                  {key.revoked ? <div className="text-xs font-semibold text-rose-600 mt-1">Revoked</div> : null}
                </div>
                <Button
                  disabled={key.revoked || revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(key.id)}
                  className="px-3 py-2 text-xs font-semibold"
                >
                  Revoke
                </Button>
              </div>
            ))}
            {!apiKeys?.length ? <p className="text-sm text-slate-500">No keys yet.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
