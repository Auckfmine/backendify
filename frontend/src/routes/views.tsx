import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";
import {
  createView,
  deleteView,
  executeView,
  fetchCollections,
  fetchFields,
  fetchViewMeta,
  fetchViewOperators,
  fetchViews,
  type Collection,
  type View,
  type ViewFilter,
  type ViewMeta,
  type ViewSort,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";

export default function ViewsPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const queryClient = useQueryClient();

  const [selectedView, setSelectedView] = useState<View | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showApiPanel, setShowApiPanel] = useState(false);
  const [executeResult, setExecuteResult] = useState<{ data: Record<string, unknown>[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  type ParamDef = { name: string; type: string; required: boolean; description: string };
  const [formData, setFormData] = useState({
    name: "",
    display_name: "",
    base_collection_id: "",
    description: "",
    projection: [] as string[],
    filters: [] as ViewFilter[],
    sorts: [] as ViewSort[],
    params_schema: [] as ParamDef[],
  });
  const [executeParams, setExecuteParams] = useState<Record<string, string>>({});

  const collectionsQuery = useQuery({
    queryKey: queryKeys.collections(projectId),
    queryFn: () => fetchCollections(projectId),
  });

  const viewsQuery = useQuery({
    queryKey: ["views", projectId],
    queryFn: () => fetchViews(projectId),
  });

  const operatorsQuery = useQuery({
    queryKey: ["view-operators", projectId],
    queryFn: () => fetchViewOperators(projectId),
  });

  const metaQuery = useQuery({
    queryKey: ["view-meta", projectId, selectedView?.name],
    queryFn: () => fetchViewMeta(projectId, selectedView!.name),
    enabled: !!selectedView && showApiPanel,
  });

  const selectedCollection = collectionsQuery.data?.find((c) => c.id === formData.base_collection_id);

  const fieldsQuery = useQuery({
    queryKey: queryKeys.fields(projectId, selectedCollection?.name || ""),
    queryFn: () => fetchFields(projectId, selectedCollection!.name),
    enabled: !!selectedCollection,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      // Convert params_schema array to dict format expected by backend
      const paramsDict: Record<string, { type: string; required: boolean; description?: string }> = {};
      formData.params_schema.forEach(p => {
        if (p.name) {
          paramsDict[p.name] = { type: p.type, required: p.required, description: p.description || undefined };
        }
      });
      
      return createView(projectId, {
        name: formData.name,
        display_name: formData.display_name,
        base_collection_id: formData.base_collection_id,
        description: formData.description || undefined,
        projection: formData.projection.length > 0 ? formData.projection : undefined,
        filters: formData.filters.length > 0 ? formData.filters : undefined,
        sorts: formData.sorts.length > 0 ? formData.sorts : undefined,
        params_schema: Object.keys(paramsDict).length > 0 ? paramsDict : undefined,
      });
    },
    onSuccess: () => {
      setSuccess("View created successfully");
      setShowCreateForm(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["views", projectId] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (viewName: string) => deleteView(projectId, viewName),
    onSuccess: () => {
      setSuccess("View deleted");
      setSelectedView(null);
      setExecuteResult(null);
      queryClient.invalidateQueries({ queryKey: ["views", projectId] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const executeMutation = useMutation({
    mutationFn: (viewName: string) => {
      const params = Object.keys(executeParams).length > 0 ? executeParams : undefined;
      return executeView(projectId, viewName, { limit: 50, params });
    },
    onSuccess: (result) => {
      setExecuteResult({ data: result.data, total: result.total });
    },
    onError: (err: Error) => setError(err.message),
  });

  const resetForm = () => {
    setFormData({
      name: "",
      display_name: "",
      base_collection_id: "",
      description: "",
      projection: [],
      filters: [],
      sorts: [],
      params_schema: [],
    });
    setExecuteParams({});
  };

  const addFilter = () => {
    setFormData({
      ...formData,
      filters: [...formData.filters, { field: "", operator: "=", value: "" }],
    });
  };

  const updateFilter = (index: number, updates: Partial<ViewFilter>) => {
    const newFilters = [...formData.filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    setFormData({ ...formData, filters: newFilters });
  };

  const removeFilter = (index: number) => {
    setFormData({
      ...formData,
      filters: formData.filters.filter((_, i) => i !== index),
    });
  };

  const addSort = () => {
    setFormData({
      ...formData,
      sorts: [...formData.sorts, { field: "", desc: false }],
    });
  };

  const updateSort = (index: number, updates: Partial<ViewSort>) => {
    const newSorts = [...formData.sorts];
    newSorts[index] = { ...newSorts[index], ...updates };
    setFormData({ ...formData, sorts: newSorts });
  };

  const removeSort = (index: number) => {
    setFormData({
      ...formData,
      sorts: formData.sorts.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Query Builder (Views)</h1>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Saved Views</h2>
            <button
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setSelectedView(null);
                setExecuteResult(null);
              }}
            >
              {showCreateForm ? "Cancel" : "New View"}
            </button>
          </div>
          <div className="space-y-2">
            {viewsQuery.data?.map((v) => (
              <div
                key={v.id}
                className={`p-3 rounded cursor-pointer border ${
                  selectedView?.id === v.id
                    ? "bg-blue-50 border-blue-300"
                    : "hover:bg-gray-50 border-gray-200"
                }`}
                onClick={() => {
                  setSelectedView(v);
                  setShowCreateForm(false);
                  setExecuteResult(null);
                }}
              >
                <div className="font-medium">{v.display_name}</div>
                <div className="text-sm text-gray-500">{v.name}</div>
                <div className="text-xs text-gray-400 mt-1">v{v.version}</div>
              </div>
            ))}
            {viewsQuery.data?.length === 0 && (
              <p className="text-gray-500 text-sm">No views yet</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {showCreateForm && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-4">Create New View</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setError(null);
                  setSuccess(null);
                  createMutation.mutate();
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name (slug)</label>
                    <input
                      type="text"
                      className="w-full border rounded px-3 py-2"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., active_users"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Display Name</label>
                    <input
                      type="text"
                      className="w-full border rounded px-3 py-2"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      placeholder="e.g., Active Users"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Base Collection</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={formData.base_collection_id}
                    onChange={(e) => setFormData({ ...formData, base_collection_id: e.target.value, projection: [], filters: [], sorts: [] })}
                    required
                  >
                    <option value="">-- Select Collection --</option>
                    {collectionsQuery.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.display_name} ({c.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    className="w-full border rounded px-3 py-2"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>

                {selectedCollection && fieldsQuery.data && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Projection (leave empty for all fields)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {["id", "created_at", "updated_at", ...fieldsQuery.data.map((f) => f.sql_column_name)].map((col) => (
                          <label key={col} className="flex items-center gap-1 text-sm">
                            <input
                              type="checkbox"
                              checked={formData.projection.includes(col)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({ ...formData, projection: [...formData.projection, col] });
                                } else {
                                  setFormData({ ...formData, projection: formData.projection.filter((p) => p !== col) });
                                }
                              }}
                            />
                            {col}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium">Filters</label>
                        <button type="button" className="text-sm text-blue-600 hover:underline" onClick={addFilter}>
                          + Add Filter
                        </button>
                      </div>
                      {formData.filters.map((filter, i) => (
                        <div key={i} className="flex gap-2 mb-2 items-center flex-wrap">
                          <select
                            className="border rounded px-2 py-1 text-sm"
                            value={filter.field}
                            onChange={(e) => updateFilter(i, { field: e.target.value })}
                          >
                            <option value="">Field</option>
                            {["id", "created_at", ...fieldsQuery.data.map((f) => f.sql_column_name)].map((col) => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                          <select
                            className="border rounded px-2 py-1 text-sm"
                            value={filter.operator}
                            onChange={(e) => updateFilter(i, { operator: e.target.value })}
                          >
                            {operatorsQuery.data?.operators.map((op) => (
                              <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                          </select>
                          {formData.params_schema.length > 0 && (
                            <select
                              className="border rounded px-2 py-1 text-sm bg-yellow-50"
                              value={(filter as { is_param?: boolean; param_name?: string }).is_param ? (filter as { param_name?: string }).param_name || "" : ""}
                              onChange={(e) => {
                                if (e.target.value) {
                                  updateFilter(i, { is_param: true, param_name: e.target.value, value: undefined } as Partial<ViewFilter>);
                                } else {
                                  updateFilter(i, { is_param: false, param_name: undefined } as Partial<ViewFilter>);
                                }
                              }}
                            >
                              <option value="">Use static value</option>
                              {formData.params_schema.map((p) => (
                                <option key={p.name} value={p.name}>Use param: {p.name}</option>
                              ))}
                            </select>
                          )}
                          {!(filter as { is_param?: boolean }).is_param && (
                            <input
                              type="text"
                              className="border rounded px-2 py-1 text-sm flex-1"
                              value={String(filter.value || "")}
                              onChange={(e) => updateFilter(i, { value: e.target.value })}
                              placeholder="Value"
                            />
                          )}
                          {(filter as { is_param?: boolean; param_name?: string }).is_param && (
                            <span className="text-sm text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                              = :{(filter as { param_name?: string }).param_name}
                            </span>
                          )}
                          <button type="button" className="text-red-500 text-sm" onClick={() => removeFilter(i)}>×</button>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium">Sort Order</label>
                        <button type="button" className="text-sm text-blue-600 hover:underline" onClick={addSort}>
                          + Add Sort
                        </button>
                      </div>
                      {formData.sorts.map((sort, i) => (
                        <div key={i} className="flex gap-2 mb-2 items-center flex-wrap">
                          {/* Field selection or param reference */}
                          {formData.params_schema.some((p: ParamDef) => p.type === "sort_field") ? (
                            <select
                              className="border rounded px-2 py-1 text-sm bg-yellow-50"
                              value={(sort as { is_param?: boolean; param_name?: string }).is_param ? (sort as { param_name?: string }).param_name || "" : ""}
                              onChange={(e) => {
                                if (e.target.value) {
                                  updateSort(i, { is_param: true, param_name: e.target.value, field: "id" } as Partial<ViewSort>);
                                } else {
                                  updateSort(i, { is_param: false, param_name: undefined } as Partial<ViewSort>);
                                }
                              }}
                            >
                              <option value="">Use static field</option>
                              {formData.params_schema.filter((p: ParamDef) => p.type === "sort_field").map((p: ParamDef) => (
                                <option key={p.name} value={p.name}>Use param: {p.name}</option>
                              ))}
                            </select>
                          ) : null}
                          {!(sort as { is_param?: boolean }).is_param && (
                            <select
                              className="border rounded px-2 py-1 text-sm flex-1"
                              value={sort.field}
                              onChange={(e) => updateSort(i, { field: e.target.value })}
                            >
                              <option value="">Field</option>
                              {["id", "created_at", ...fieldsQuery.data.map((f) => f.sql_column_name)].map((col) => (
                                <option key={col} value={col}>{col}</option>
                              ))}
                            </select>
                          )}
                          {(sort as { is_param?: boolean }).is_param && (
                            <span className="text-sm text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                              field: :{(sort as { param_name?: string }).param_name}
                            </span>
                          )}
                          {/* Direction selection or param reference */}
                          {formData.params_schema.some((p: ParamDef) => p.type === "sort_direction") ? (
                            <select
                              className="border rounded px-2 py-1 text-sm bg-yellow-50"
                              value={(sort as { desc_is_param?: boolean; desc_param_name?: string }).desc_is_param ? (sort as { desc_param_name?: string }).desc_param_name || "" : ""}
                              onChange={(e) => {
                                if (e.target.value) {
                                  updateSort(i, { desc_is_param: true, desc_param_name: e.target.value } as Partial<ViewSort>);
                                } else {
                                  updateSort(i, { desc_is_param: false, desc_param_name: undefined } as Partial<ViewSort>);
                                }
                              }}
                            >
                              <option value="">Use static direction</option>
                              {formData.params_schema.filter((p: ParamDef) => p.type === "sort_direction").map((p: ParamDef) => (
                                <option key={p.name} value={p.name}>Use param: {p.name}</option>
                              ))}
                            </select>
                          ) : null}
                          {!(sort as { desc_is_param?: boolean }).desc_is_param && (
                            <select
                              className="border rounded px-2 py-1 text-sm"
                              value={sort.desc ? "desc" : "asc"}
                              onChange={(e) => updateSort(i, { desc: e.target.value === "desc" })}
                            >
                              <option value="asc">Ascending</option>
                              <option value="desc">Descending</option>
                            </select>
                          )}
                          {(sort as { desc_is_param?: boolean }).desc_is_param && (
                            <span className="text-sm text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                              dir: :{(sort as { desc_param_name?: string }).desc_param_name}
                            </span>
                          )}
                          <button type="button" className="text-red-500 text-sm" onClick={() => removeSort(i)}>×</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Parameters Schema */}
                <div>
                  <label className="block text-sm font-medium mb-1">Parameters (for parameterized views)</label>
                  <p className="text-xs text-gray-500 mb-2">
                    Use <code className="bg-gray-100 px-1">limit</code>/<code className="bg-gray-100 px-1">offset</code> for pagination, 
                    <code className="bg-gray-100 px-1">sort_field</code>/<code className="bg-gray-100 px-1">sort_direction</code> for dynamic sorting
                  </p>
                  <div className="flex gap-2 mb-2 flex-wrap">
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        params_schema: [...prev.params_schema, { name: "", type: "string", required: false, description: "" }]
                      }))}
                    >
                      + Add Param
                    </button>
                    <button
                      type="button"
                      className="text-xs text-green-600 hover:underline"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        params_schema: [
                          ...prev.params_schema,
                          { name: "page_size", type: "limit", required: false, description: "Results per page" },
                          { name: "page_offset", type: "offset", required: false, description: "Pagination offset" },
                        ]
                      }))}
                    >
                      + Add Pagination Params
                    </button>
                    <button
                      type="button"
                      className="text-xs text-purple-600 hover:underline"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        params_schema: [
                          ...prev.params_schema,
                          { name: "sort_by", type: "sort_field", required: false, description: "Field to sort by" },
                          { name: "sort_order", type: "sort_direction", required: false, description: "asc or desc" },
                        ],
                        // Auto-add a parameterized sort entry
                        sorts: [
                          ...prev.sorts,
                          { field: "id", desc: false, is_param: true, param_name: "sort_by", desc_is_param: true, desc_param_name: "sort_order" },
                        ],
                      }))}
                    >
                      + Add Sort Params
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formData.params_schema.map((param, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="name"
                          className="border rounded px-2 py-1 text-sm w-24"
                          value={param.name}
                          onChange={(e) => {
                            const updated = [...formData.params_schema];
                            updated[i] = { ...updated[i], name: e.target.value };
                            setFormData(prev => ({ ...prev, params_schema: updated }));
                          }}
                        />
                        <select
                          className="border rounded px-2 py-1 text-sm"
                          value={param.type}
                          onChange={(e) => {
                            const updated = [...formData.params_schema];
                            updated[i] = { ...updated[i], type: e.target.value };
                            setFormData(prev => ({ ...prev, params_schema: updated }));
                          }}
                        >
                          <option value="string">string</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                          <option value="limit">limit (pagination)</option>
                          <option value="offset">offset (pagination)</option>
                          <option value="sort_field">sort_field</option>
                          <option value="sort_direction">sort_direction</option>
                        </select>
                        <label className="flex items-center gap-1 text-sm">
                          <input
                            type="checkbox"
                            checked={param.required}
                            onChange={(e) => {
                              const updated = [...formData.params_schema];
                              updated[i] = { ...updated[i], required: e.target.checked };
                              setFormData(prev => ({ ...prev, params_schema: updated }));
                            }}
                          />
                          Required
                        </label>
                        <input
                          type="text"
                          placeholder="description"
                          className="border rounded px-2 py-1 text-sm flex-1"
                          value={param.description}
                          onChange={(e) => {
                            const updated = [...formData.params_schema];
                            updated[i] = { ...updated[i], description: e.target.value };
                            setFormData(prev => ({ ...prev, params_schema: updated }));
                          }}
                        />
                        <button
                          type="button"
                          className="text-red-500 text-sm"
                          onClick={() => {
                            const updated = formData.params_schema.filter((_, idx) => idx !== i);
                            setFormData(prev => ({ ...prev, params_schema: updated }));
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create View"}
                </button>
              </form>
            </div>
          )}

          {selectedView && (
            <>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedView.display_name}</h2>
                    <p className="text-sm text-gray-500">{selectedView.name} (v{selectedView.version})</p>
                    {selectedView.description && (
                      <p className="text-sm text-gray-600 mt-1">{selectedView.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      onClick={() => executeMutation.mutate(selectedView.name)}
                      disabled={executeMutation.isPending}
                    >
                      {executeMutation.isPending ? "Running..." : "Execute"}
                    </button>
                    <button
                      className={`px-3 py-1 text-sm rounded ${showApiPanel ? "bg-purple-700 text-white" : "bg-purple-600 text-white hover:bg-purple-700"}`}
                      onClick={() => setShowApiPanel(!showApiPanel)}
                    >
                      {showApiPanel ? "Hide API" : "API & Usage"}
                    </button>
                    <button
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      onClick={() => deleteMutation.mutate(selectedView.name)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Projection:</span>{" "}
                    {selectedView.projection?.join(", ") || "All fields"}
                  </div>
                  <div>
                    <span className="font-medium">Limits:</span>{" "}
                    Default: {selectedView.default_limit}, Max: {selectedView.max_limit}
                  </div>
                </div>

                {/* Params input for execution */}
                {selectedView.params_schema && Object.keys(selectedView.params_schema).length > 0 && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <span className="font-medium text-sm text-yellow-800">Parameters:</span>
                    <div className="mt-2 space-y-2">
                      {Object.entries(selectedView.params_schema).map(([paramName, paramDef]: [string, { type: string; required: boolean; description?: string }]) => (
                        <div key={paramName} className="flex items-center gap-2">
                          <label className="text-sm w-32">
                            {paramName}
                            {paramDef.required && <span className="text-red-500">*</span>}
                          </label>
                          <input
                            type={paramDef.type === "number" ? "number" : "text"}
                            className="border rounded px-2 py-1 text-sm flex-1"
                            placeholder={paramDef.description || paramName}
                            value={executeParams[paramName] || ""}
                            onChange={(e) => setExecuteParams(prev => ({ ...prev, [paramName]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedView.filters && selectedView.filters.length > 0 && (
                  <div className="mt-3">
                    <span className="font-medium text-sm">Filters:</span>
                    <div className="mt-1 space-y-1">
                      {selectedView.filters.map((f, i) => (
                        <div key={i} className="text-sm bg-gray-50 px-2 py-1 rounded">
                          {f.field} {f.operator} {String(f.value)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedView.sorts && selectedView.sorts.length > 0 && (
                  <div className="mt-3">
                    <span className="font-medium text-sm">Sort:</span>
                    <div className="mt-1 space-y-1">
                      {selectedView.sorts.map((s: ViewSort, i: number) => (
                        <div key={i} className="text-sm bg-gray-50 px-2 py-1 rounded">
                          {s.is_param ? (
                            <span className="text-yellow-700">:{s.param_name}</span>
                          ) : (
                            <span>{s.field}</span>
                          )}{" "}
                          {s.desc_is_param ? (
                            <span className="text-yellow-700">:{s.desc_param_name}</span>
                          ) : (
                            <span>{s.desc ? "DESC" : "ASC"}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {showApiPanel && metaQuery.data && (
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-semibold mb-4 text-purple-700">API & Usage Documentation</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Endpoint</h4>
                      <div className="bg-gray-100 p-3 rounded font-mono text-sm">
                        <span className="text-green-600 font-bold">{metaQuery.data.endpoint.method}</span>{" "}
                        {metaQuery.data.endpoint.url}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm mb-2">Authentication</h4>
                      <ul className="text-sm text-gray-600 list-disc list-inside">
                        {metaQuery.data.endpoint.auth.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm mb-2">Request Body</h4>
                      <div className="text-sm space-y-1">
                        <div className="flex gap-2">
                          <code className="bg-gray-100 px-1 rounded">limit</code>
                          <span className="text-gray-500">int, default: {metaQuery.data.request.body.limit.default}, max: {metaQuery.data.request.body.limit.max}</span>
                        </div>
                        <div className="flex gap-2">
                          <code className="bg-gray-100 px-1 rounded">offset</code>
                          <span className="text-gray-500">int, default: 0</span>
                        </div>
                        {metaQuery.data.request.body.params && metaQuery.data.request.body.params.fields.length > 0 && (
                          <div>
                            <code className="bg-gray-100 px-1 rounded">params</code>
                            <span className="text-gray-500 ml-2">object with:</span>
                            <ul className="ml-4 mt-1 text-gray-600">
                              {metaQuery.data.request.body.params.fields.map((p, i) => (
                                <li key={i}>
                                  <code>{p.name}</code> ({p.type}){p.required && <span className="text-red-500">*</span>}
                                  {p.description && <span className="text-gray-400"> - {p.description}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm mb-2">Response Fields</h4>
                      <div className="flex flex-wrap gap-2">
                        {metaQuery.data.response.fields.map((f, i) => (
                          <span key={i} className="bg-gray-100 px-2 py-1 rounded text-xs">
                            {f.name} <span className="text-gray-400">({f.type})</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm mb-2">cURL Example</h4>
                      <div className="relative">
                        <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">{metaQuery.data.examples.curl}</pre>
                        <button
                          className="absolute top-2 right-2 px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                          onClick={() => navigator.clipboard.writeText(metaQuery.data!.examples.curl)}
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm mb-2">Fetch (TypeScript) Example</h4>
                      <div className="relative">
                        <pre className="bg-gray-900 text-blue-400 p-3 rounded text-xs overflow-x-auto">{metaQuery.data.examples.fetch}</pre>
                        <button
                          className="absolute top-2 right-2 px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                          onClick={() => navigator.clipboard.writeText(metaQuery.data!.examples.fetch)}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {executeResult && (
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-semibold mb-2">Results ({executeResult.total} total)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {executeResult.data.length > 0 &&
                            Object.keys(executeResult.data[0]).map((key) => (
                              <th key={key} className="text-left p-2 font-medium">
                                {key}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {executeResult.data.map((row, i) => (
                          <tr key={i} className="border-t">
                            {Object.values(row).map((val, j) => (
                              <td key={j} className="p-2">
                                {val === null ? <span className="text-gray-400">null</span> : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {executeResult.data.length === 0 && (
                      <p className="text-gray-500 text-center py-4">No results</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {!showCreateForm && !selectedView && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Select a view to execute or create a new one
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
