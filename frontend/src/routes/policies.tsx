import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Shield, Plus, Trash2, Check, X, Users, Key, Globe, User, Zap, Edit3 } from "lucide-react";
import {
  Collection,
  Policy,
  Field,
  Role,
  fetchCollections,
  fetchFields,
  fetchPolicies,
  createPolicy,
  deletePolicy,
  fetchRoles,
} from "../lib/api";
import { Button, Card, Input, PageHeader, Badge, FormField, Select, EmptyState } from "../components/ui";

const POLICY_ACTIONS = ["create", "read", "update", "delete", "list"];
const POLICY_EFFECTS = ["allow", "deny"];
const PRINCIPAL_TYPES = [
  { value: "admin_user", label: "Admin User (Console)", description: "Users logged into the admin console" },
  { value: "app_user", label: "App User", description: "End users authenticated via your app" },
  { value: "api_key", label: "API Key", description: "Server-to-server requests with API key" },
  { value: "anonymous", label: "Anonymous", description: "Unauthenticated public access" },
];

const CONDITION_OPERATORS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: "greater or equal" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "less or equal" },
  { value: "contains", label: "contains" },
  { value: "starts_with", label: "starts with" },
];

const SPECIAL_VALUES = [
  { value: "$current_user_id", label: "Current User ID" },
  { value: "$now", label: "Current Time" },
  { value : "$current_app_user_id", label: "Current App User ID"},
];

type ConditionRule = {
  field: string;
  operator: string;
  value: string;
  useSpecialValue: boolean;
};

function ConditionBuilder({
  conditions,
  setConditions,
  fields,
}: {
  conditions: ConditionRule[];
  setConditions: (c: ConditionRule[]) => void;
  fields: Field[];
}) {
  const addCondition = () => {
    setConditions([
      ...conditions,
      { field: "created_by_app_user_id", operator: "eq", value: "", useSpecialValue: false },
    ]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<ConditionRule>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setConditions(newConditions);
  };

  const availableFields = [
    { name: "created_by_user_id", display: "Created By (User ID)" },
    { name: "created_by_app_user_id", display: "Created By (App User ID)" },
    { name: "id", display: "Record ID" },
    { name: "created_at", display: "Created At" },
    { name: "updated_at", display: "Updated At" },
    ...fields.map((f) => ({ name: f.name, display: f.display_name })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="block text-sm font-medium text-slate-700">
          Conditions (optional)
        </label>
        <button
          type="button"
          onClick={addCondition}
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Condition
        </button>
      </div>

      {conditions.length === 0 && (
        <p className="text-sm text-slate-500 italic">
          No conditions — policy applies to all records
        </p>
      )}

      {conditions.map((condition, index) => (
        <div key={index} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-slate-500">
              Condition {index + 1}
            </span>
            <button
              type="button"
              onClick={() => removeCondition(index)}
              className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700"
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Select
              value={condition.field}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateCondition(index, { field: e.target.value })}
            >
              {availableFields.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.display}
                </option>
              ))}
            </Select>

            <Select
              value={condition.operator}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateCondition(index, { operator: e.target.value })}
            >
              {CONDITION_OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </Select>

            <div className="flex gap-1">
              {condition.useSpecialValue ? (
                <Select
                  value={condition.value}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateCondition(index, { value: e.target.value })}
                  className="flex-1"
                >
                  <option value="">Select...</option>
                  {SPECIAL_VALUES.map((sv) => (
                    <option key={sv.value} value={sv.value}>
                      {sv.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  placeholder="Value"
                  value={condition.value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCondition(index, { value: e.target.value })}
                  className="flex-1"
                />
              )}
              <button
                type="button"
                onClick={() =>
                  updateCondition(index, {
                    useSpecialValue: !condition.useSpecialValue,
                    value: "",
                  })
                }
                className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                  condition.useSpecialValue
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                title={condition.useSpecialValue ? "Use custom value" : "Use special value"}
              >
                {condition.useSpecialValue ? <Zap className="h-3.5 w-3.5" /> : <Edit3 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      ))}

      {conditions.length > 1 && (
        <p className="text-xs text-slate-500">
          All conditions must match (AND logic)
        </p>
      )}
    </div>
  );
}

function conditionsToJson(conditions: ConditionRule[]): string | undefined {
  if (conditions.length === 0) return undefined;

  const obj: Record<string, unknown> = {};
  for (const c of conditions) {
    if (c.operator === "eq") {
      obj[c.field] = c.value;
    } else {
      obj[c.field] = { [`$${c.operator}`]: c.value };
    }
  }
  return JSON.stringify(obj);
}

function parseConditionJson(json: string | null): ConditionRule[] {
  if (!json) return [];
  try {
    const obj = JSON.parse(json);
    const rules: ConditionRule[] = [];
    for (const [field, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        rules.push({
          field,
          operator: "eq",
          value,
          useSpecialValue: value.startsWith("$"),
        });
      } else if (typeof value === "object" && value !== null) {
        const entries = Object.entries(value as Record<string, string>);
        if (entries.length > 0) {
          const [op, val] = entries[0];
          rules.push({
            field,
            operator: op.replace("$", ""),
            value: String(val),
            useSpecialValue: String(val).startsWith("$"),
          });
        }
      }
    }
    return rules;
  } catch {
    return [];
  }
}

export default function PoliciesPage() {
  const params = useRouterState({ select: (s) => s.matches.at(-1)?.params }) as { projectId: string } | undefined;
  const projectId = params?.projectId ?? "";
  const queryClient = useQueryClient();

  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [action, setAction] = useState("read");
  const [effect, setEffect] = useState("allow");
  const [conditions, setConditions] = useState<ConditionRule[]>([]);
  const [allowedPrincipals, setAllowedPrincipals] = useState<string[]>(["admin_user", "api_key"]);
  const [requireEmailVerified, setRequireEmailVerified] = useState(false);
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);

  const collectionsQuery = useQuery({
    queryKey: ["projects", projectId, "collections"],
    queryFn: () => fetchCollections(projectId),
  });

  const fieldsQuery = useQuery({
    queryKey: ["projects", projectId, "collections", selectedCollection, "fields"],
    queryFn: () => fetchFields(projectId, selectedCollection!),
    enabled: !!selectedCollection,
  });

  const policiesQuery = useQuery({
    queryKey: ["projects", projectId, "collections", selectedCollection, "policies"],
    queryFn: () => fetchPolicies(projectId, selectedCollection!),
    enabled: !!selectedCollection,
  });

  const rolesQuery = useQuery({
    queryKey: ["roles", projectId],
    queryFn: () => fetchRoles(projectId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createPolicy(projectId, selectedCollection!, {
        name,
        action,
        effect,
        condition_json: conditionsToJson(conditions),
        allowed_principals: allowedPrincipals.length > 0 ? allowedPrincipals.join(",") : undefined,
        require_email_verified: requireEmailVerified,
        allowed_roles: allowedRoles.length > 0 ? allowedRoles.join(",") : undefined,
      }),
    onSuccess: () => {
      setName("");
      setAction("read");
      setEffect("allow");
      setConditions([]);
      setAllowedPrincipals(["admin_user", "api_key"]);
      setRequireEmailVerified(false);
      setAllowedRoles([]);
      queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "collections", selectedCollection, "policies"],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (policyId: string) => deletePolicy(projectId, selectedCollection!, policyId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "collections", selectedCollection, "policies"],
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && action && selectedCollection) {
      createMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security"
        title="Policies"
        description="Define access control rules for your collections"
        icon={<Shield className="h-6 w-6" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Collections Sidebar */}
        <Card padding="md" className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Collections</h3>
            <Badge tone="indigo">{collectionsQuery.data?.length || 0}</Badge>
          </div>
          {collectionsQuery.isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          )}
          <div className="space-y-2">
            {collectionsQuery.data?.map((collection: Collection) => (
              <div
                key={collection.id}
                className={`p-3 rounded-xl cursor-pointer transition-all border-2 ${
                  selectedCollection === collection.name
                    ? "bg-indigo-50 border-indigo-300 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
                onClick={() => setSelectedCollection(collection.name)}
              >
                <div className="flex items-center gap-2">
                  <Shield className={`h-4 w-4 ${selectedCollection === collection.name ? "text-indigo-600" : "text-slate-400"}`} />
                  <div>
                    <div className="font-medium text-slate-900">{collection.display_name}</div>
                    <div className="text-xs text-slate-500 font-mono">{collection.name}</div>
                  </div>
                </div>
              </div>
            ))}
            {!collectionsQuery.data?.length && !collectionsQuery.isLoading && (
              <EmptyState
                icon={<Shield className="h-5 w-5" />}
                title="No collections"
                description="Create collections in Schema Builder first"
              />
            )}
          </div>
        </Card>

        {/* Policies Panel */}
        <Card padding="md" className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Policies {selectedCollection && <span className="text-slate-500">• {selectedCollection}</span>}
            </h3>
            {policiesQuery.data && <Badge tone="emerald">{policiesQuery.data.length} policies</Badge>}
          </div>

          {selectedCollection ? (
            <>
              {/* Create Policy Form */}
              <form onSubmit={handleSubmit} className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <h4 className="font-medium text-slate-900">Create New Policy</h4>
                <FormField label="Policy name">
                  <Input
                    placeholder="e.g., Allow read for all"
                    value={name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Action">
                    <Select
                      value={action}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAction(e.target.value)}
                    >
                      {POLICY_ACTIONS.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Effect">
                    <Select
                      value={effect}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEffect(e.target.value)}
                    >
                      {POLICY_EFFECTS.map((e) => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </Select>
                  </FormField>
                </div>

                <FormField label="Allowed Principals" hint="Select which types of users can access this resource">
                  <div className="grid grid-cols-2 gap-2">
                    {PRINCIPAL_TYPES.map((pt) => (
                      <label
                        key={pt.value}
                        className={`flex items-start p-3 border-2 rounded-xl cursor-pointer transition-all ${
                          allowedPrincipals.includes(pt.value)
                            ? "bg-indigo-50 border-indigo-300"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 mr-2 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={allowedPrincipals.includes(pt.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAllowedPrincipals([...allowedPrincipals, pt.value]);
                            } else {
                              setAllowedPrincipals(allowedPrincipals.filter((p) => p !== pt.value));
                            }
                          }}
                        />
                        <div>
                          <div className="font-medium text-sm text-slate-900">{pt.label}</div>
                          <div className="text-xs text-slate-500">{pt.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </FormField>

                {allowedPrincipals.includes("app_user") && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <input
                      type="checkbox"
                      id="requireEmailVerified"
                      checked={requireEmailVerified}
                      onChange={(e) => setRequireEmailVerified(e.target.checked)}
                      className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <label htmlFor="requireEmailVerified" className="text-sm">
                      <span className="font-medium text-amber-800">Require email verification</span>
                      <span className="text-amber-700 ml-1">— Only allow verified emails</span>
                    </label>
                  </div>
                )}

                {allowedPrincipals.includes("app_user") && (
                  <FormField label="Restrict to Roles (RBAC)" hint="Optional: Only allow users with specific roles">
                    {rolesQuery.data && rolesQuery.data.length > 0 ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {rolesQuery.data.map((role: Role) => (
                            <label
                              key={role.id}
                              className={`inline-flex items-center px-3 py-1.5 border-2 rounded-lg cursor-pointer transition-all text-sm ${
                                allowedRoles.includes(role.name)
                                  ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                                  : "bg-white border-slate-200 hover:border-slate-300 text-slate-600"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={allowedRoles.includes(role.name)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setAllowedRoles([...allowedRoles, role.name]);
                                  } else {
                                    setAllowedRoles(allowedRoles.filter((r) => r !== role.name));
                                  }
                                }}
                              />
                              <Users className="h-3.5 w-3.5 mr-1.5" />
                              {role.display_name}
                            </label>
                          ))}
                        </div>
                        {allowedRoles.length === 0 && (
                          <p className="text-xs text-slate-500 mt-1">No roles selected — all app users can access</p>
                        )}
                      </>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                        <p>No roles created yet.</p>
                        <a href={`/projects/${projectId}/rbac`} className="text-indigo-600 hover:text-indigo-700 font-medium">
                          Go to RBAC page to create roles →
                        </a>
                      </div>
                    )}
                  </FormField>
                )}

                <ConditionBuilder
                  conditions={conditions}
                  setConditions={setConditions}
                  fields={fieldsQuery.data || []}
                />
                <Button 
                  type="submit" 
                  loading={createMutation.isPending}
                  disabled={!name || allowedPrincipals.length === 0}
                  icon={<Plus className="h-4 w-4" />}
                  className="w-full"
                >
                  Create Policy
                </Button>
              </form>

              {/* Policies List */}
              {policiesQuery.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : policiesQuery.data?.length ? (
                <div className="space-y-2">
                  {policiesQuery.data.map((policy: Policy) => (
                    <div
                      key={policy.id}
                      className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${policy.effect === "allow" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
                              {policy.effect === "allow" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                            </div>
                            <div className="font-medium text-slate-900">{policy.name}</div>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-3">
                            <Badge tone={policy.effect === "allow" ? "emerald" : "rose"}>{policy.effect}</Badge>
                            <Badge tone="indigo">{policy.action}</Badge>
                            {policy.is_active ? <Badge tone="emerald">Active</Badge> : <Badge tone="slate">Inactive</Badge>}
                            {policy.require_email_verified && <Badge tone="amber">Email Verified</Badge>}
                          </div>
                          {policy.allowed_principals && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="text-xs text-slate-500">Principals:</span>
                              {policy.allowed_principals.split(",").map((p) => (
                                <Badge key={p} tone="purple">{p.trim()}</Badge>
                              ))}
                            </div>
                          )}
                          {policy.allowed_roles && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="text-xs text-slate-500">Roles:</span>
                              {policy.allowed_roles.split(",").map((r) => (
                                <Badge key={r} tone="cyan">{r.trim()}</Badge>
                              ))}
                            </div>
                          )}
                          {policy.condition_json && (
                            <div className="mt-2 text-xs text-slate-500 font-mono bg-slate-100 p-2 rounded-lg">
                              {policy.condition_json}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => deleteMutation.mutate(policy.id)}
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
              ) : (
                <EmptyState
                  icon={<Shield className="h-6 w-6" />}
                  title="No policies yet"
                  description="Create your first policy to define access control rules"
                />
              )}
            </>
          ) : (
            <EmptyState
              icon={<Shield className="h-6 w-6" />}
              title="Select a collection"
              description="Choose a collection from the left panel to manage its policies"
            />
          )}
        </Card>
      </div>
    </div>
  );
}
