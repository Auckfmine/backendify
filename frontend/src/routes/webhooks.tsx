import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Webhook as WebhookIcon, Plus, Trash2, AlertCircle, Link, Key } from "lucide-react";
import {
  Webhook,
  fetchWebhooks,
  createWebhook,
  deleteWebhook,
} from "../lib/api";
import { Button, Card, Input, PageHeader, Badge, FormField, EmptyState } from "../components/ui";

const WEBHOOK_EVENTS = [
  "record.created",
  "record.updated",
  "record.deleted",
  "collection.created",
  "field.created",
];

export default function WebhooksPage() {
  const params = useRouterState({ select: (s) => s.matches.at(-1)?.params }) as { projectId: string } | undefined;
  const projectId = params?.projectId ?? "";
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const webhooksQuery = useQuery({
    queryKey: ["projects", projectId, "webhooks"],
    queryFn: () => fetchWebhooks(projectId),
  });

  const createMutation = useMutation({
    mutationFn: () => createWebhook(projectId, { name, url, events: selectedEvents }),
    onSuccess: (data) => {
      setCreatedSecret(data.secret);
      setName("");
      setUrl("");
      setSelectedEvents([]);
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "webhooks"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (webhookId: string) => deleteWebhook(projectId, webhookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "webhooks"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && url && selectedEvents.length > 0) {
      createMutation.mutate();
    }
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Integrations"
        title="Webhooks"
        description="Notify external systems when events occur in your project"
        icon={<WebhookIcon className="h-6 w-6" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Webhook Panel */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Create Webhook</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <FormField label="Webhook name">
              <Input
                placeholder="e.g., Slack notifications"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              />
            </FormField>
            <FormField label="Endpoint URL">
              <Input
                placeholder="https://example.com/webhook"
                value={url}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
              />
            </FormField>
            <FormField label="Events" hint="Select events to trigger this webhook">
              <div className="flex flex-wrap gap-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <button
                    key={event}
                    type="button"
                    onClick={() => toggleEvent(event)}
                    className={`px-3 py-1.5 text-sm rounded-lg border-2 transition-all ${
                      selectedEvents.includes(event)
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-medium"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {event}
                  </button>
                ))}
              </div>
            </FormField>
            <Button 
              type="submit" 
              loading={createMutation.isPending}
              disabled={!name || !url || selectedEvents.length === 0}
              icon={<Plus className="h-4 w-4" />}
              className="w-full"
            >
              Create Webhook
            </Button>
          </form>

          {createdSecret && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Key className="h-4 w-4 text-amber-600" />
                <p className="font-semibold text-amber-800">Webhook Secret</p>
              </div>
              <code className="block break-all text-amber-900 bg-amber-100 p-3 rounded-lg font-mono text-sm">{createdSecret}</code>
              <p className="text-sm text-amber-700 mt-2">Save this now! You won't be able to see it again.</p>
            </div>
          )}
        </Card>

        {/* Registered Webhooks Panel */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Registered Webhooks</h3>
            <Badge tone="indigo">{webhooksQuery.data?.length || 0}</Badge>
          </div>

          {webhooksQuery.isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          )}

          {webhooksQuery.error && (
            <div className="flex items-center gap-2 text-rose-600 text-sm p-3 bg-rose-50 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              Error loading webhooks
            </div>
          )}

          {!webhooksQuery.isLoading && webhooksQuery.data?.length === 0 && (
            <EmptyState
              icon={<WebhookIcon className="h-6 w-6" />}
              title="No webhooks yet"
              description="Create your first webhook to start receiving notifications"
            />
          )}

          <div className="space-y-2">
            {webhooksQuery.data?.map((webhook: Webhook) => (
              <div
                key={webhook.id}
                className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                        <WebhookIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{webhook.name}</div>
                        <div className="text-xs text-slate-500 font-mono truncate">{webhook.url}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {webhook.events.map((event) => (
                        <Badge key={event} tone="slate">{event}</Badge>
                      ))}
                    </div>
                    <div className="text-xs text-slate-400 mt-2">
                      Created {new Date(webhook.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(webhook.id)}
                    disabled={deleteMutation.isPending}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
