import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  Webhook,
  fetchWebhooks,
  createWebhook,
  deleteWebhook,
} from "../lib/api";
import { Button, Card, Input, SectionTitle } from "../components/ui";

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
      <SectionTitle>Webhooks</SectionTitle>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Create Webhook</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Webhook name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="URL (https://example.com/webhook)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Events</label>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((event) => (
                <button
                  key={event}
                  type="button"
                  onClick={() => toggleEvent(event)}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    selectedEvents.includes(event)
                      ? "bg-blue-100 border-blue-500 text-blue-700"
                      : "bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {event}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={createMutation.isPending || !name || !url || selectedEvents.length === 0}>
            {createMutation.isPending ? "Creating..." : "Create Webhook"}
          </Button>
        </form>

        {createdSecret && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="font-semibold text-amber-800 mb-2">Webhook Secret (save this now!)</p>
            <code className="block break-all text-amber-900 bg-amber-100 p-2 rounded">{createdSecret}</code>
            <p className="text-sm text-amber-700 mt-2">This secret is used to verify webhook signatures.</p>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Registered Webhooks</h3>
        {webhooksQuery.isLoading && <p className="text-gray-500">Loading...</p>}
        {webhooksQuery.error && <p className="text-red-500">Error loading webhooks</p>}

        {webhooksQuery.data?.length === 0 && (
          <p className="text-gray-500">No webhooks registered yet</p>
        )}

        <div className="space-y-3">
          {webhooksQuery.data?.map((webhook: Webhook) => (
            <div
              key={webhook.id}
              className="p-4 border rounded-lg flex justify-between items-start"
            >
              <div>
                <div className="font-medium">{webhook.name}</div>
                <div className="text-sm text-gray-500 break-all">{webhook.url}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {webhook.events.map((event) => (
                    <span
                      key={event}
                      className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
                    >
                      {event}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  Created: {new Date(webhook.created_at).toLocaleString()}
                </div>
              </div>
              <Button
                className="bg-red-600 hover:bg-red-700 text-sm"
                onClick={() => deleteMutation.mutate(webhook.id)}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
