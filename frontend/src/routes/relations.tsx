import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";
import {
  createRelationField,
  fetchCollections,
  fetchFields,
  fetchRelationFields,
  fetchRelationOptions,
  fetchReverseRelations,
  type Collection,
  type RelationField,
  type ReverseRelation,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";

export default function RelationsPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const queryClient = useQueryClient();

  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    display_name: "",
    target_collection_id: "",
    relation_type: "many_to_one",
    on_delete: "RESTRICT",
    is_required: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const collectionsQuery = useQuery({
    queryKey: queryKeys.collections(projectId),
    queryFn: () => fetchCollections(projectId),
  });

  const relationsQuery = useQuery({
    queryKey: ["relations", projectId, selectedCollection?.id],
    queryFn: () => fetchRelationFields(projectId, selectedCollection!.id),
    enabled: !!selectedCollection,
  });

  const reverseRelationsQuery = useQuery({
    queryKey: ["reverse-relations", projectId, selectedCollection?.id],
    queryFn: () => fetchReverseRelations(projectId, selectedCollection!.id),
    enabled: !!selectedCollection,
  });

  const optionsQuery = useQuery({
    queryKey: ["relation-options", projectId],
    queryFn: () => fetchRelationOptions(projectId),
  });

  const fieldsQuery = useQuery({
    queryKey: queryKeys.fields(projectId, selectedCollection?.name || ""),
    queryFn: () => fetchFields(projectId, selectedCollection!.name),
    enabled: !!selectedCollection,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createRelationField(projectId, selectedCollection!.id, {
        name: formData.name,
        display_name: formData.display_name,
        target_collection_id: formData.target_collection_id,
        relation_type: formData.relation_type,
        on_delete: formData.on_delete,
        is_required: formData.is_required,
      }),
    onSuccess: () => {
      setSuccess("Relation field created successfully");
      setShowCreateForm(false);
      setFormData({
        name: "",
        display_name: "",
        target_collection_id: "",
        relation_type: "many_to_one",
        on_delete: "RESTRICT",
        is_required: false,
      });
      queryClient.invalidateQueries({ queryKey: ["relations", projectId, selectedCollection?.id] });
      queryClient.invalidateQueries({ queryKey: queryKeys.fields(projectId, selectedCollection!.name) });
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    createMutation.mutate();
  };

  const targetCollections = collectionsQuery.data?.filter((c) => c.id !== selectedCollection?.id) || [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Relationship Builder</h1>

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
          <h2 className="text-lg font-semibold mb-4">Collections</h2>
          <div className="space-y-2">
            {collectionsQuery.data?.map((c) => (
              <div
                key={c.id}
                className={`p-3 rounded cursor-pointer border ${
                  selectedCollection?.id === c.id
                    ? "bg-blue-50 border-blue-300"
                    : "hover:bg-gray-50 border-gray-200"
                }`}
                onClick={() => {
                  setSelectedCollection(c);
                  setShowCreateForm(false);
                }}
              >
                <div className="font-medium">{c.display_name}</div>
                <div className="text-sm text-gray-500">{c.name}</div>
              </div>
            ))}
            {collectionsQuery.data?.length === 0 && (
              <p className="text-gray-500 text-sm">No collections yet</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {selectedCollection ? (
            <>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">
                    Relations from {selectedCollection.display_name}
                  </h2>
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    onClick={() => setShowCreateForm(!showCreateForm)}
                  >
                    {showCreateForm ? "Cancel" : "Add Relation"}
                  </button>
                </div>

                {showCreateForm && (
                  <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Field Name (slug)</label>
                        <input
                          type="text"
                          className="w-full border rounded px-3 py-2"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g., customer"
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
                          placeholder="e.g., Customer"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Target Collection</label>
                        <select
                          className="w-full border rounded px-3 py-2"
                          value={formData.target_collection_id}
                          onChange={(e) => setFormData({ ...formData, target_collection_id: e.target.value })}
                          required
                        >
                          <option value="">-- Select --</option>
                          {targetCollections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.display_name} ({c.name})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">On Delete</label>
                        <select
                          className="w-full border rounded px-3 py-2"
                          value={formData.on_delete}
                          onChange={(e) => setFormData({ ...formData, on_delete: e.target.value })}
                        >
                          {optionsQuery.data?.on_delete_actions.map((a) => (
                            <option key={a.value} value={a.value}>
                              {a.label} - {a.description}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.is_required}
                            onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                          />
                          <span className="text-sm">Required field</span>
                        </label>
                      </div>
                    </div>
                    <div className="mt-4">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        disabled={createMutation.isPending}
                      >
                        {createMutation.isPending ? "Creating..." : "Create Relation"}
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-3">
                  {relationsQuery.data?.map((r: RelationField) => (
                    <div key={r.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{r.display_name}</div>
                          <div className="text-sm text-gray-500">
                            {r.name} → {r.target_collection_name}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                            {r.relation_type}
                          </span>
                          <div className="mt-1 text-gray-500">
                            ON DELETE {r.relation_on_delete}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-400">
                        Column: {r.sql_column_name} {r.is_required && "(required)"}
                      </div>
                    </div>
                  ))}
                  {relationsQuery.data?.length === 0 && (
                    <p className="text-gray-500 text-sm">No outgoing relations</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="text-lg font-semibold mb-4">
                  Incoming Relations (References to {selectedCollection.display_name})
                </h2>
                <div className="space-y-3">
                  {reverseRelationsQuery.data?.map((r: ReverseRelation) => (
                    <div key={r.id} className="p-3 border rounded-lg bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{r.source_collection_name}.{r.name}</div>
                          <div className="text-sm text-gray-500">
                            References this collection
                          </div>
                        </div>
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">
                          {r.relation_type}
                        </span>
                      </div>
                    </div>
                  ))}
                  {reverseRelationsQuery.data?.length === 0 && (
                    <p className="text-gray-500 text-sm">No incoming relations</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="text-lg font-semibold mb-4">All Fields</h2>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Column</th>
                      <th className="text-left p-2">Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldsQuery.data?.map((f) => (
                      <tr key={f.id} className="border-t">
                        <td className="p-2">{f.display_name}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            f.field_type === "relation" ? "bg-blue-100 text-blue-800" : "bg-gray-100"
                          }`}>
                            {f.field_type}
                          </span>
                        </td>
                        <td className="p-2 font-mono text-xs">{f.sql_column_name}</td>
                        <td className="p-2">{f.is_required ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Select a collection to manage its relationships
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
