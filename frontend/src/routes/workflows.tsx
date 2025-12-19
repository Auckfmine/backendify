import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { GitBranch, Plus, Trash2, Play, Pause, Zap } from "lucide-react";
import {
  Workflow,
  fetchWorkflows,
  createWorkflow,
  deleteWorkflow,
} from "../lib/api";
import { Button, Card, Input, PageHeader, Badge, FormField, Select, EmptyState } from "../components/ui";

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
      <PageHeader
        eyebrow="Automation"
        title="Workflows"
        description="Automate tasks with event-driven workflows"
        icon={<GitBranch className="h-6 w-6" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Workflow Panel */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Create Workflow</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <FormField label="Workflow name">
              <Input
                placeholder="e.g., Send welcome email"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              />
            </FormField>
            <FormField label="Description" hint="Optional">
              <Input
                placeholder="What does this workflow do?"
                value={description}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
              />
            </FormField>

            <FormField label="Trigger">
              <Select
                value={triggerType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTriggerType(e.target.value)}
              >
                {TRIGGER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </FormField>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-slate-700">Steps</label>
                <button
                  type="button"
                  onClick={addStep}
                  className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Step
                </button>
              </div>

              {steps.length === 0 && (
                <p className="text-sm text-slate-500 italic">No steps added yet</p>
              )}

              {steps.map((step, index) => (
                <div key={index} className="p-3 bg-white rounded-lg border border-slate-200 mb-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-700">Step {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                  <Select
                    value={step.action}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateStep(index, "action", e.target.value)}
                  >
                    {ACTION_TYPES.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </Select>
                  {step.action === "http_request" && (
                    <div className="mt-2">
                      <Input
                        placeholder="URL (https://example.com/endpoint)"
                        value={step.url || ""}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateStep(index, "url", e.target.value)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button 
              type="submit" 
              loading={createMutation.isPending}
              disabled={!name}
              icon={<Plus className="h-4 w-4" />}
              className="w-full"
            >
              Create Workflow
            </Button>
          </form>
        </Card>

        {/* Workflows List Panel */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Workflows</h3>
            <Badge tone="indigo">{workflowsQuery.data?.length || 0}</Badge>
          </div>

          {workflowsQuery.isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          )}

          {workflowsQuery.error && (
            <div className="flex items-center gap-2 text-rose-600 text-sm p-3 bg-rose-50 rounded-lg">
              Error loading workflows
            </div>
          )}

          {!workflowsQuery.isLoading && workflowsQuery.data?.length === 0 && (
            <EmptyState
              icon={<GitBranch className="h-6 w-6" />}
              title="No workflows yet"
              description="Create your first workflow to automate tasks"
            />
          )}

          <div className="space-y-2">
            {workflowsQuery.data?.map((workflow: Workflow) => (
              <div
                key={workflow.id}
                className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${workflow.is_active ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                        {workflow.is_active ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{workflow.name}</div>
                        {workflow.description && (
                          <div className="text-xs text-slate-500">{workflow.description}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-3">
                      <Badge tone="indigo">{workflow.trigger_type}</Badge>
                      <Badge tone="slate">{workflow.steps.length} step{workflow.steps.length !== 1 ? "s" : ""}</Badge>
                      {workflow.is_active ? (
                        <Badge tone="emerald">Active</Badge>
                      ) : (
                        <Badge tone="slate">Inactive</Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-2">
                      Created {new Date(workflow.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(workflow.id)}
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
