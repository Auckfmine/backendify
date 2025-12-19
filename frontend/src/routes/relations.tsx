import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";
import { Link2, Plus, ArrowRight, ArrowLeft, Database } from "lucide-react";
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
import { Button, Card, Input, PageHeader, Badge, FormField, Select, EmptyState } from "../components/ui";

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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Schema"
        title="Relationship Builder"
        description="Define relationships between your collections"
        icon={<Link2 className="h-6 w-6" />}
      />

      {error && (
        <div className="flex items-center gap-2 text-rose-600 text-sm p-3 bg-rose-50 rounded-xl border border-rose-200">
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-emerald-600 text-sm p-3 bg-emerald-50 rounded-xl border border-emerald-200">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  setShowCreateForm(false);
                }}
              >
                <div className="flex items-center gap-2">
                  <Link2 className={`h-4 w-4 ${selectedCollection?.id === c.id ? "text-indigo-600" : "text-slate-400"}`} />
                  <div>
                    <div className="font-medium text-slate-900">{c.display_name}</div>
                    <div className="text-xs text-slate-500 font-mono">{c.name}</div>
                  </div>
                </div>
              </div>
            ))}
            {collectionsQuery.data?.length === 0 && (
              <EmptyState
                icon={<Link2 className="h-5 w-5" />}
                title="No collections"
                description="Create collections in Schema Builder first"
              />
            )}
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {selectedCollection ? (
            <>
              {/* Outgoing Relations */}
              <Card padding="md">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Relations from {selectedCollection.display_name}
                  </h2>
                  <Button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    variant={showCreateForm ? "secondary" : "primary"}
                    icon={showCreateForm ? undefined : <Plus className="h-4 w-4" />}
                  >
                    {showCreateForm ? "Cancel" : "Add Relation"}
                  </Button>
                </div>

                {showCreateForm && (
                  <form onSubmit={handleSubmit} className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Field Name (slug)">
                        <Input
                          value={formData.name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g., customer"
                          required
                        />
                      </FormField>
                      <FormField label="Display Name">
                        <Input
                          value={formData.display_name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, display_name: e.target.value })}
                          placeholder="e.g., Customer"
                          required
                        />
                      </FormField>
                      <FormField label="Target Collection">
                        <Select
                          value={formData.target_collection_id}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, target_collection_id: e.target.value })}
                          required
                        >
                          <option value="">-- Select --</option>
                          {targetCollections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.display_name} ({c.name})
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="On Delete">
                        <Select
                          value={formData.on_delete}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, on_delete: e.target.value })}
                        >
                          {optionsQuery.data?.on_delete_actions.map((a) => (
                            <option key={a.value} value={a.value}>
                              {a.label} - {a.description}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <div className="col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.is_required}
                            onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-slate-700">Required field</span>
                        </label>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      loading={createMutation.isPending}
                      icon={<Plus className="h-4 w-4" />}
                      className="w-full"
                    >
                      Create Relation
                    </Button>
                  </form>
                )}

                <div className="space-y-2">
                  {relationsQuery.data?.map((r: RelationField) => (
                    <div key={r.id} className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                            <ArrowRight className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{r.display_name}</div>
                            <div className="text-xs text-slate-500 font-mono">
                              {r.name} → {r.target_collection_name}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge tone="indigo">{r.relation_type}</Badge>
                          <span className="text-xs text-slate-500">ON DELETE {r.relation_on_delete}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-slate-400 ml-11">
                        Column: <span className="font-mono">{r.sql_column_name}</span> {r.is_required && <Badge tone="rose">required</Badge>}
                      </div>
                    </div>
                  ))}
                  {relationsQuery.data?.length === 0 && (
                    <EmptyState
                      icon={<ArrowRight className="h-5 w-5" />}
                      title="No outgoing relations"
                      description="Add a relation to link to another collection"
                    />
                  )}
                </div>
              </Card>

              {/* Incoming Relations */}
              <Card padding="md">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Incoming Relations
                  </h2>
                  <Badge tone="purple">{reverseRelationsQuery.data?.length || 0}</Badge>
                </div>
                <div className="space-y-2">
                  {reverseRelationsQuery.data?.map((r: ReverseRelation) => (
                    <div key={r.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                            <ArrowLeft className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{r.source_collection_name}.{r.name}</div>
                            <div className="text-xs text-slate-500">References this collection</div>
                          </div>
                        </div>
                        <Badge tone="purple">{r.relation_type}</Badge>
                      </div>
                    </div>
                  ))}
                  {reverseRelationsQuery.data?.length === 0 && (
                    <EmptyState
                      icon={<ArrowLeft className="h-5 w-5" />}
                      title="No incoming relations"
                      description="No other collections reference this one"
                    />
                  )}
                </div>
              </Card>

              {/* All Fields */}
              <Card padding="md">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">All Fields</h2>
                  <Badge tone="slate">{fieldsQuery.data?.length || 0} fields</Badge>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-xs">Name</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-xs">Type</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-xs">Column</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-xs">Required</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fieldsQuery.data?.map((f) => (
                        <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-900">{f.display_name}</td>
                          <td className="px-4 py-3">
                            <Badge tone={f.field_type === "relation" ? "indigo" : "slate"}>{f.field_type}</Badge>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{f.sql_column_name}</td>
                          <td className="px-4 py-3">
                            {f.is_required ? <Badge tone="rose">Yes</Badge> : <span className="text-slate-400">No</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : (
            <Card padding="lg">
              <EmptyState
                icon={<Link2 className="h-6 w-6" />}
                title="Select a collection"
                description="Choose a collection from the left panel to manage its relationships"
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
