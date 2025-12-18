import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  Workflow,
  fetchWorkflows,
  createWorkflow,
  deleteWorkflow,
} from "../lib/api";
import { Button, Card, Input, SectionTitle } from "../components/ui";

const TRIGGER_TYPES = [
  { value: "record.created", label: "Record Created" },
  { value: "record.updated", label: "Record Updated" },
  { value: "record.deleted", label: "Record Deleted" },
  { value: "manual", label: "Manual Trigger" },
  { value: "schedule", label: "Scheduled" },
];

const ACTION_TYPES = [
  { value: "http_request", label: "HTTP Request" },
  { value: "delay", label: "Delay" },
  { value: "transform", label: "Transform Data" },
];

export default function WorkflowsPage() {
  const params = useRouterState({ select: (s) => s.matches.at(-1)?.params }) as { projectId: string } | undefined;
  const projectId = params?.projectId ?? "";
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("record.created");
  const [steps, setSteps] = useState<{ action: string; url?: string }[]>([]);

  const workflowsQuery = useQuery({
    queryKey: ["projects", projectId, "workflows"],
    queryFn: () => fetchWorkflows(projectId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createWorkflow(projectId, {
        name,
        description: description || undefined,
        trigger_type: triggerType,
        trigger_config: {},
        steps: steps.map((s) => ({ action: s.action, url: s.url })),
      }),
    onSuccess: () => {
      setName("");
      setDescription("");
      setTriggerType("record.created");
      setSteps([]);
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "workflows"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (workflowId: string) => deleteWorkflow(projectId, workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "workflows"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && triggerType) {
      createMutation.mutate();
    }
  };

  const addStep = () => {
    setSteps([...steps, { action: "http_request", url: "" }]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: string, value: string) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  return (
    <div className="space-y-6">
      <SectionTitle>Workflows</SectionTitle>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Create Workflow</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Workflow name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Trigger</label>
            <select
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value)}
            >
              {TRIGGER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">Steps</label>
              <button
                type="button"
                onClick={addStep}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                + Add Step
              </button>
            </div>

            {steps.length === 0 && (
              <p className="text-sm text-gray-500">No steps added yet</p>
            )}

            {steps.map((step, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg mb-2">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium">Step {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    className="text-red-500 text-sm hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
                <select
                  className="w-full px-3 py-2 border rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={step.action}
                  onChange={(e) => updateStep(index, "action", e.target.value)}
                >
                  {ACTION_TYPES.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
                {step.action === "http_request" && (
                  <Input
                    placeholder="URL (https://example.com/endpoint)"
                    value={step.url || ""}
                    onChange={(e) => updateStep(index, "url", e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>

          <Button type="submit" disabled={createMutation.isPending || !name}>
            {createMutation.isPending ? "Creating..." : "Create Workflow"}
          </Button>
        </form>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Workflows</h3>
        {workflowsQuery.isLoading && <p className="text-gray-500">Loading...</p>}
        {workflowsQuery.error && <p className="text-red-500">Error loading workflows</p>}

        {workflowsQuery.data?.length === 0 && (
          <p className="text-gray-500">No workflows created yet</p>
        )}

        <div className="space-y-3">
          {workflowsQuery.data?.map((workflow: Workflow) => (
            <div
              key={workflow.id}
              className="p-4 border rounded-lg flex justify-between items-start"
            >
              <div>
                <div className="font-medium">{workflow.name}</div>
                {workflow.description && (
                  <div className="text-sm text-gray-500">{workflow.description}</div>
                )}
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                    {workflow.trigger_type}
                  </span>
                  <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                    {workflow.steps.length} step{workflow.steps.length !== 1 ? "s" : ""}
                  </span>
                  {workflow.is_active ? (
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  Created: {new Date(workflow.created_at).toLocaleString()}
                </div>
              </div>
              <Button
                className="bg-red-600 hover:bg-red-700 text-sm"
                onClick={() => deleteMutation.mutate(workflow.id)}
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
