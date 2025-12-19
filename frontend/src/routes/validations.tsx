import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";
import { CheckSquare, Plus, Trash2, AlertCircle, Shield } from "lucide-react";
import {
  createValidationRule,
  deleteValidationRule,
  fetchCollections,
  fetchFields,
  fetchValidationRules,
  fetchValidationRuleTypes,
  type Collection,
  type Field,
  type ValidationRule,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { Button, Card, Input, PageHeader, Badge, FormField, Select, EmptyState } from "../components/ui";

export default function ValidationsPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const queryClient = useQueryClient();

  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    rule_type: "",
    config: {} as Record<string, unknown>,
    error_message: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const collectionsQuery = useQuery({
    queryKey: queryKeys.collections(projectId),
    queryFn: () => fetchCollections(projectId),
  });

  const fieldsQuery = useQuery({
    queryKey: queryKeys.fields(projectId, selectedCollection?.name || ""),
    queryFn: () => fetchFields(projectId, selectedCollection!.name),
    enabled: !!selectedCollection,
  });

  const rulesQuery = useQuery({
    queryKey: ["validation-rules", projectId, selectedCollection?.name, selectedField?.name],
    queryFn: () => fetchValidationRules(projectId, selectedCollection!.name, selectedField!.name),
    enabled: !!selectedCollection && !!selectedField,
  });

  const ruleTypesQuery = useQuery({
    queryKey: ["validation-rule-types", projectId],
    queryFn: () => fetchValidationRuleTypes(projectId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createValidationRule(projectId, selectedCollection!.name, selectedField!.name, {
        rule_type: formData.rule_type,
        config: Object.keys(formData.config).length > 0 ? formData.config : undefined,
        error_message: formData.error_message || undefined,
      }),
    onSuccess: () => {
      setSuccess("Validation rule created");
      setShowCreateForm(false);
      setFormData({ rule_type: "", config: {}, error_message: "" });
      queryClient.invalidateQueries({
        queryKey: ["validation-rules", projectId, selectedCollection?.name, selectedField?.name],
      });
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => deleteValidationRule(projectId, ruleId),
    onSuccess: () => {
      setSuccess("Rule deleted");
      queryClient.invalidateQueries({
        queryKey: ["validation-rules", projectId, selectedCollection?.name, selectedField?.name],
      });
    },
    onError: (err: Error) => setError(err.message),
  });

  const selectedRuleType = ruleTypesQuery.data?.rule_types.find((rt) => rt.type === formData.rule_type);

  const handleConfigChange = (key: string, value: string) => {
    const schema = selectedRuleType?.config_schema || {};
    let parsedValue: unknown = value;
    
    if (schema[key] === "int" || schema[key] === "number") {
      parsedValue = parseFloat(value) || 0;
    } else if (schema[key] === "list") {
      parsedValue = value.split(",").map((v) => v.trim());
    }
    
    setFormData({
      ...formData,
      config: { ...formData.config, [key]: parsedValue },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Data Quality"
        title="Validation Rules"
        description="Define constraints and validation rules for your data"
        icon={<CheckSquare className="h-6 w-6" />}
      />

      {error && (
        <div className="flex items-center gap-2 text-rose-600 text-sm p-3 bg-rose-50 rounded-xl border border-rose-200">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-emerald-600 text-sm p-3 bg-emerald-50 rounded-xl border border-emerald-200">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Collections Sidebar */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Collections</h2>
            <Badge tone="indigo">{collectionsQuery.data?.length || 0}</Badge>
          </div>
          <div className="space-y-2">
            {collectionsQuery.data?.map((c) => (
              <div
                key={c.id}
                className={`p-3 rounded-xl cursor-pointer transition-all border-2 ${
                  selectedCollection?.id === c.id
                    ? "bg-indigo-50 border-indigo-300 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
                onClick={() => {
                  setSelectedCollection(c);
                  setSelectedField(null);
                  setShowCreateForm(false);
                }}
              >
                <div className="flex items-center gap-2">
                  <Shield className={`h-4 w-4 ${selectedCollection?.id === c.id ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="font-medium text-slate-900">{c.display_name}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Fields Sidebar */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Fields</h2>
            {fieldsQuery.data && <Badge tone="slate">{fieldsQuery.data.length}</Badge>}
          </div>
          {selectedCollection ? (
            <div className="space-y-2">
              {fieldsQuery.data?.map((f) => (
                <div
                  key={f.id}
                  className={`p-3 rounded-xl cursor-pointer transition-all border-2 ${
                    selectedField?.id === f.id
                      ? "bg-indigo-50 border-indigo-300 shadow-sm"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                  onClick={() => {
                    setSelectedField(f);
                    setShowCreateForm(false);
                  }}
                >
                  <div className="font-medium text-slate-900">{f.display_name}</div>
                  <Badge tone="slate">{f.field_type}</Badge>
                </div>
              ))}
              {fieldsQuery.data?.length === 0 && (
                <EmptyState
                  icon={<CheckSquare className="h-5 w-5" />}
                  title="No fields"
                  description="Add fields to this collection first"
                />
              )}
            </div>
          ) : (
            <EmptyState
              icon={<CheckSquare className="h-5 w-5" />}
              title="Select a collection"
              description="Choose a collection to see its fields"
            />
          )}
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {selectedField ? (
            <>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Rules for {selectedField.display_name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedCollection?.name}.{selectedField.name} ({selectedField.field_type})
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    variant={showCreateForm ? "secondary" : "primary"}
                    icon={showCreateForm ? undefined : <Plus className="h-4 w-4" />}
                  >
                    {showCreateForm ? "Cancel" : "Add Rule"}
                  </Button>
                </div>

                {showCreateForm && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setError(null);
                      setSuccess(null);
                      createMutation.mutate();
                    }}
                    className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4"
                  >
                    <FormField label="Rule Type">
                      <Select
                        value={formData.rule_type}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, rule_type: e.target.value, config: {} })}
                        required
                      >
                        <option value="">-- Select Rule Type --</option>
                        {ruleTypesQuery.data?.rule_types
                          .filter((rt) => rt.applies_to.includes(selectedField.field_type) || rt.applies_to.includes("all"))
                          .map((rt) => (
                            <option key={rt.type} value={rt.type}>
                              {rt.type}
                            </option>
                          ))}
                      </Select>
                    </FormField>

                    {selectedRuleType && Object.keys(selectedRuleType.config_schema).length > 0 && (
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-700">Configuration</label>
                        {Object.entries(selectedRuleType.config_schema).map(([key, type]) => (
                          <FormField key={key} label={`${key} (${type})`}>
                            <Input
                              type={type === "int" || type === "number" ? "number" : "text"}
                              placeholder={type === "list" ? "comma,separated,values" : `Enter ${key}`}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange(key, e.target.value)}
                            />
                          </FormField>
                        ))}
                      </div>
                    )}

                    <FormField label="Custom Error Message" hint="Optional">
                      <Input
                        value={formData.error_message}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, error_message: e.target.value })}
                        placeholder="e.g., Please enter a valid value"
                      />
                    </FormField>

                    <Button
                      type="submit"
                      loading={createMutation.isPending}
                      disabled={!formData.rule_type}
                      icon={<Plus className="h-4 w-4" />}
                      className="w-full"
                    >
                      Create Rule
                    </Button>
                  </form>
                )}

                <div className="space-y-2">
                  {rulesQuery.data?.map((rule: ValidationRule) => (
                    <div key={rule.id} className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge tone="purple">{rule.rule_type}</Badge>
                          {rule.config && Object.keys(rule.config).length > 0 && (
                            <div className="text-sm text-slate-600 mt-2 font-mono bg-slate-50 p-2 rounded-lg">
                              {JSON.stringify(rule.config)}
                            </div>
                          )}
                          {rule.error_message && (
                            <div className="text-sm text-slate-500 mt-1">
                              Message: "{rule.error_message}"
                            </div>
                          )}
                        </div>
                        <button
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          onClick={() => deleteMutation.mutate(rule.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {rule.is_active ? <Badge tone="emerald">Active</Badge> : <Badge tone="slate">Inactive</Badge>}
                        <Badge tone="slate">Priority: {rule.priority}</Badge>
                      </div>
                    </div>
                  ))}
                  {rulesQuery.data?.length === 0 && (
                    <p className="text-gray-500 text-sm">No validation rules for this field</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold mb-3">Available Rule Types</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {ruleTypesQuery.data?.rule_types
                    .filter((rt) => rt.applies_to.includes(selectedField.field_type) || rt.applies_to.includes("all"))
                    .map((rt) => (
                      <div key={rt.type} className="p-2 bg-gray-50 rounded">
                        <div className="font-medium">{rt.type}</div>
                        <div className="text-xs text-gray-500">
                          {Object.keys(rt.config_schema).length > 0
                            ? `Config: ${Object.keys(rt.config_schema).join(", ")}`
                            : "No config needed"}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Select a collection and field to manage validation rules
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
