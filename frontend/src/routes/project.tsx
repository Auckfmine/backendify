import { Link, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";

import {
  createApiKey,
  fetchApiKeys,
  fetchProject,
  revokeApiKey,
  ApiKey,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { Button, Card, Input, SectionTitle } from "../components/ui";

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

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <SectionTitle>Project</SectionTitle>
        <p className="text-sm text-slate-600 mt-2">{project?.name}</p>
        <p className="text-xs text-slate-500">{project?.id}</p>
        <div className="mt-4 flex gap-3">
          <Link
            to="/projects/$projectId/schema"
            params={{ projectId }}
            className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Schema Builder
          </Link>
          <Link
            to="/projects/$projectId/data"
            params={{ projectId }}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Data Explorer
          </Link>
          <Link
            to="/projects/$projectId/logs"
            params={{ projectId }}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Logs
          </Link>
          <Link
            to="/projects/$projectId/webhooks"
            params={{ projectId }}
            className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            Webhooks
          </Link>
          <Link
            to="/projects/$projectId/workflows"
            params={{ projectId }}
            className="inline-flex items-center px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
          >
            Workflows
          </Link>
          <Link
            to="/projects/$projectId/policies"
            params={{ projectId }}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Policies
          </Link>
          <Link
            to="/projects/$projectId/schema-evolution"
            params={{ projectId }}
            className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            Schema Evolution
          </Link>
          <Link
            to="/projects/$projectId/relations"
            params={{ projectId }}
            className="inline-flex items-center px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            Relations
          </Link>
          <Link
            to="/projects/$projectId/views"
            params={{ projectId }}
            className="inline-flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            Views
          </Link>
          <Link
            to="/projects/$projectId/validations"
            params={{ projectId }}
            className="inline-flex items-center px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
          >
            Validations
          </Link>
          <Link
            to="/projects/$projectId/files"
            params={{ projectId }}
            className="inline-flex items-center px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            Files
          </Link>
          <Link
            to="/projects/$projectId/auth"
            params={{ projectId }}
            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            App Auth
          </Link>
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle>Create API key</SectionTitle>
        <form className="mt-4 flex gap-3" onSubmit={handleSubmit}>
          <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="API key name" />
          <Button type="submit">{createKeyMutation.isPending ? "Creating..." : "Create"}</Button>
        </form>
        {createdKey ? (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">
            <p className="font-semibold text-amber-800 mb-1">Copy your API key now</p>
            <code className="block break-all text-amber-900">{createdKey}</code>
          </div>
        ) : null}
      </Card>

      <Card className="p-6">
        <SectionTitle>API Keys</SectionTitle>
        <div className="mt-4 space-y-3">
          {(apiKeys || []).map((key: ApiKey) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
            >
              <div>
                <div className="font-semibold">{key.name}</div>
                <div className="text-xs text-slate-500">Prefix: {key.prefix}</div>
                <div className="text-xs text-slate-500">Created: {new Date(key.created_at).toLocaleString()}</div>
                {key.revoked ? <div className="text-xs text-red-500 mt-1">Revoked</div> : null}
              </div>
              <Button
                disabled={key.revoked || revokeMutation.isPending}
                onClick={() => revokeMutation.mutate(key.id)}
                className="bg-rose-600 hover:bg-rose-700"
              >
                Revoke
              </Button>
            </div>
          ))}
          {!apiKeys?.length ? <p className="text-sm text-slate-500">No keys yet.</p> : null}
        </div>
      </Card>
    </div>
  );
}
