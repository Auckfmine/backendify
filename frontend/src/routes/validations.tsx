import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";
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
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Validation Rules</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Collections</h2>
          <div className="space-y-2">
            {collectionsQuery.data?.map((c) => (
              <div
                key={c.id}
                className={`p-2 rounded cursor-pointer border text-sm ${
                  selectedCollection?.id === c.id
                    ? "bg-blue-50 border-blue-300"
                    : "hover:bg-gray-50 border-gray-200"
                }`}
                onClick={() => {
                  setSelectedCollection(c);
                  setSelectedField(null);
                  setShowCreateForm(false);
                }}
              >
                {c.display_name}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Fields</h2>
          {selectedCollection ? (
            <div className="space-y-2">
              {fieldsQuery.data?.map((f) => (
                <div
                  key={f.id}
                  className={`p-2 rounded cursor-pointer border text-sm ${
                    selectedField?.id === f.id
                      ? "bg-blue-50 border-blue-300"
                      : "hover:bg-gray-50 border-gray-200"
                  }`}
                  onClick={() => {
                    setSelectedField(f);
                    setShowCreateForm(false);
                  }}
                >
                  <div className="font-medium">{f.display_name}</div>
                  <div className="text-xs text-gray-500">{f.field_type}</div>
                </div>
              ))}
              {fieldsQuery.data?.length === 0 && (
                <p className="text-gray-500 text-sm">No fields</p>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Select a collection</p>
          )}
        </div>

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
                  <button
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    onClick={() => setShowCreateForm(!showCreateForm)}
                  >
                    {showCreateForm ? "Cancel" : "Add Rule"}
                  </button>
                </div>

                {showCreateForm && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setError(null);
                      setSuccess(null);
                      createMutation.mutate();
                    }}
                    className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium mb-1">Rule Type</label>
                      <select
                        className="w-full border rounded px-3 py-2"
                        value={formData.rule_type}
                        onChange={(e) => setFormData({ ...formData, rule_type: e.target.value, config: {} })}
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
                      </select>
                    </div>

                    {selectedRuleType && Object.keys(selectedRuleType.config_schema).length > 0 && (
                      <div className="space-y-3">
                        <label className="block text-sm font-medium">Configuration</label>
                        {Object.entries(selectedRuleType.config_schema).map(([key, type]) => (
                          <div key={key}>
                            <label className="block text-xs text-gray-600 mb-1">
                              {key} ({type})
                            </label>
                            <input
                              type={type === "int" || type === "number" ? "number" : "text"}
                              className="w-full border rounded px-3 py-2 text-sm"
                              placeholder={type === "list" ? "comma,separated,values" : `Enter ${key}`}
                              onChange={(e) => handleConfigChange(key, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-1">Custom Error Message (optional)</label>
                      <input
                        type="text"
                        className="w-full border rounded px-3 py-2"
                        value={formData.error_message}
                        onChange={(e) => setFormData({ ...formData, error_message: e.target.value })}
                        placeholder="e.g., Please enter a valid value"
                      />
                    </div>

                    <button
                      type="submit"
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      disabled={createMutation.isPending || !formData.rule_type}
                    >
                      {createMutation.isPending ? "Creating..." : "Create Rule"}
                    </button>
                  </form>
                )}

                <div className="space-y-3">
                  {rulesQuery.data?.map((rule: ValidationRule) => (
                    <div key={rule.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-sm">
                              {rule.rule_type}
                            </span>
                          </div>
                          {rule.config && Object.keys(rule.config).length > 0 && (
                            <div className="text-sm text-gray-600 mt-1">
                              Config: {JSON.stringify(rule.config)}
                            </div>
                          )}
                          {rule.error_message && (
                            <div className="text-sm text-gray-500 mt-1">
                              Message: "{rule.error_message}"
                            </div>
                          )}
                        </div>
                        <button
                          className="text-red-600 text-sm hover:underline"
                          onClick={() => deleteMutation.mutate(rule.id)}
                        >
                          Delete
                        </button>
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        {rule.is_active ? "Active" : "Inactive"} • Priority: {rule.priority}
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
