import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  Collection,
  Policy,
  Field,
  fetchCollections,
  fetchFields,
  fetchPolicies,
  createPolicy,
  deletePolicy,
} from "../lib/api";
import { Button, Card, Input, SectionTitle } from "../components/ui";

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
        <label className="block text-sm font-medium text-gray-700">
          Conditions (optional)
        </label>
        <button
          type="button"
          onClick={addCondition}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          + Add Condition
        </button>
      </div>

      {conditions.length === 0 && (
        <p className="text-sm text-gray-500 italic">
          No conditions - policy applies to all records
        </p>
      )}

      {conditions.map((condition, index) => (
        <div key={index} className="p-3 bg-white border rounded-lg space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-gray-500">
              Condition {index + 1}
            </span>
            <button
              type="button"
              onClick={() => removeCondition(index)}
              className="text-red-500 text-xs hover:text-red-700"
            >
              Remove
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <select
              className="px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={condition.field}
              onChange={(e) => updateCondition(index, { field: e.target.value })}
            >
              {availableFields.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.display}
                </option>
              ))}
            </select>

            <select
              className="px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={condition.operator}
              onChange={(e) => updateCondition(index, { operator: e.target.value })}
            >
              {CONDITION_OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>

            <div className="flex gap-1">
              {condition.useSpecialValue ? (
                <select
                  className="flex-1 px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={condition.value}
                  onChange={(e) => updateCondition(index, { value: e.target.value })}
                >
                  <option value="">Select...</option>
                  {SPECIAL_VALUES.map((sv) => (
                    <option key={sv.value} value={sv.value}>
                      {sv.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="flex-1 px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Value"
                  value={condition.value}
                  onChange={(e) => updateCondition(index, { value: e.target.value })}
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
                className={`px-2 py-1 text-xs rounded ${
                  condition.useSpecialValue
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600"
                }`}
                title={condition.useSpecialValue ? "Use custom value" : "Use special value"}
              >
                {condition.useSpecialValue ? "⚡" : "✏️"}
              </button>
            </div>
          </div>
        </div>
      ))}

      {conditions.length > 1 && (
        <p className="text-xs text-gray-500">
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

  const createMutation = useMutation({
    mutationFn: () =>
      createPolicy(projectId, selectedCollection!, {
        name,
        action,
        effect,
        condition_json: conditionsToJson(conditions),
        allowed_principals: allowedPrincipals.length > 0 ? allowedPrincipals.join(",") : undefined,
        require_email_verified: requireEmailVerified,
      }),
    onSuccess: () => {
      setName("");
      setAction("read");
      setEffect("allow");
      setConditions([]);
      setAllowedPrincipals(["admin_user", "api_key"]);
      setRequireEmailVerified(false);
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
      <SectionTitle>Policies</SectionTitle>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Collections Sidebar */}
        <Card className="lg:col-span-1">
          <h3 className="text-lg font-semibold mb-4">Collections</h3>
          {collectionsQuery.isLoading && <p className="text-gray-500">Loading...</p>}
          <div className="space-y-2">
            {collectionsQuery.data?.map((collection: Collection) => (
              <div
                key={collection.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedCollection === collection.name
                    ? "bg-blue-100 border-2 border-blue-500"
                    : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
                }`}
                onClick={() => setSelectedCollection(collection.name)}
              >
                <div className="font-medium">{collection.display_name}</div>
                <div className="text-sm text-gray-500">{collection.name}</div>
              </div>
            ))}
            {!collectionsQuery.data?.length && !collectionsQuery.isLoading && (
              <p className="text-sm text-gray-500">No collections yet. Create one in Schema Builder.</p>
            )}
          </div>
        </Card>

        {/* Policies Panel */}
        <Card className="lg:col-span-3">
          {selectedCollection ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Policies for {selectedCollection}</h3>
              </div>

              {/* Create Policy Form */}
              <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3">
                <h4 className="font-medium">Create New Policy</h4>
                <Input
                  placeholder="Policy name (e.g., 'Allow read for all')"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={action}
                      onChange={(e) => setAction(e.target.value)}
                    >
                      {POLICY_ACTIONS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Effect</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={effect}
                      onChange={(e) => setEffect(e.target.value)}
                    >
                      {POLICY_EFFECTS.map((e) => (
                        <option key={e} value={e}>
                          {e}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Allowed Principals */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Allowed Principals
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Select which types of users can access this resource
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {PRINCIPAL_TYPES.map((pt) => (
                      <label
                        key={pt.value}
                        className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                          allowedPrincipals.includes(pt.value)
                            ? "bg-blue-50 border-blue-500"
                            : "bg-white border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 mr-2"
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
                          <div className="font-medium text-sm">{pt.label}</div>
                          <div className="text-xs text-gray-500">{pt.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Require Email Verified (only show if app_user is selected) */}
                {allowedPrincipals.includes("app_user") && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <input
                      type="checkbox"
                      id="requireEmailVerified"
                      checked={requireEmailVerified}
                      onChange={(e) => setRequireEmailVerified(e.target.checked)}
                    />
                    <label htmlFor="requireEmailVerified" className="text-sm">
                      <span className="font-medium">Require email verification</span>
                      <span className="text-gray-500 ml-1">
                        - Only allow app users with verified emails
                      </span>
                    </label>
                  </div>
                )}

                <ConditionBuilder
                  conditions={conditions}
                  setConditions={setConditions}
                  fields={fieldsQuery.data || []}
                />
                <Button type="submit" disabled={createMutation.isPending || !name || allowedPrincipals.length === 0}>
                  {createMutation.isPending ? "Creating..." : "Create Policy"}
                </Button>
              </form>

              {/* Policies List */}
              {policiesQuery.isLoading ? (
                <p className="text-gray-500">Loading policies...</p>
              ) : policiesQuery.data?.length ? (
                <div className="space-y-3">
                  {policiesQuery.data.map((policy: Policy) => (
                    <div
                      key={policy.id}
                      className="p-4 border rounded-lg flex justify-between items-start"
                    >
                      <div>
                        <div className="font-medium">{policy.name}</div>
                        <div className="flex gap-2 mt-2">
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                              policy.effect === "allow"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {policy.effect}
                          </span>
                          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                            {policy.action}
                          </span>
                          {policy.is_active ? (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">
                              Inactive
                            </span>
                          )}
                          {policy.require_email_verified && (
                            <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                              Email Verified
                            </span>
                          )}
                        </div>
                        {/* Allowed Principals */}
                        {policy.allowed_principals && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className="text-xs text-gray-500">Principals:</span>
                            {policy.allowed_principals.split(",").map((p) => (
                              <span
                                key={p}
                                className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full"
                              >
                                {p.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                        {policy.condition_json && (
                          <div className="mt-2 text-xs text-gray-500 font-mono bg-gray-100 p-2 rounded">
                            {policy.condition_json}
                          </div>
                        )}
                      </div>
                      <Button
                        className="bg-red-600 hover:bg-red-700 text-sm"
                        onClick={() => deleteMutation.mutate(policy.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No policies defined for this collection</p>
              )}
            </>
          ) : (
            <p className="text-gray-500">Select a collection to manage its policies</p>
          )}
        </Card>
      </div>
    </div>
  );
}
