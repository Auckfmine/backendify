import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  Table2,
  Plus,
  Trash2,
  Database,
  AlertCircle,
  Layers,
} from "lucide-react";
import {
  Collection,
  Field,
  DataRecord,
  fetchCollections,
  fetchFields,
  fetchRecords,
  createRecord,
  deleteRecord,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import {
  Button,
  Card,
  Input,
  PageHeader,
  Badge,
  FormField,
  EmptyState,
} from "../components/ui";

function RelationSelect({
  field,
  projectId,
  collections,
  value,
  onChange,
}: {
  field: Field;
  projectId: string;
  collections: Collection[];
  value: string;
  onChange: (val: string) => void;
}) {
  const targetCollection = collections.find((c) => c.id === field.relation_target_collection_id);
  
  const recordsQuery = useQuery({
    queryKey: queryKeys.records(projectId, targetCollection?.name || ""),
    queryFn: () => fetchRecords(projectId, targetCollection!.name),
    enabled: !!targetCollection,
  });

  const records = recordsQuery.data?.records || [];

  return (
    <select
      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">-- Select {field.display_name} --</option>
      {records.map((record: DataRecord) => (
        <option key={String(record.id)} value={String(record.id)}>
          {String(record.id)} - {Object.values(record).slice(1, 3).join(" | ")}
        </option>
      ))}
    </select>
  );
}

export default function DataExplorerPage() {
  const params = useRouterState({ select: (s) => s.matches.at(-1)?.params }) as { projectId: string } | undefined;
  const projectId = params?.projectId ?? "";
  const queryClient = useQueryClient();

  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [newRecordData, setNewRecordData] = useState<Record<string, string>>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});

  const collectionsQuery = useQuery({
    queryKey: queryKeys.collections(projectId),
    queryFn: () => fetchCollections(projectId),
  });

  const fieldsQuery = useQuery({
    queryKey: queryKeys.fields(projectId, selectedCollection || ""),
    queryFn: () => fetchFields(projectId, selectedCollection!),
    enabled: !!selectedCollection,
  });

  const recordsQuery = useQuery({
    queryKey: queryKeys.records(projectId, selectedCollection || ""),
    queryFn: () => fetchRecords(projectId, selectedCollection!),
    enabled: !!selectedCollection,
  });

  const createRecordMutation = useMutation({
    mutationFn: () => createRecord(projectId, selectedCollection!, newRecordData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.records(projectId, selectedCollection!) });
      setNewRecordData({});
      setShowCreateForm(false);
      setValidationErrors({});
    },
    onError: (error: Error) => {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.detail?.validation_errors) {
          setValidationErrors(parsed.detail.validation_errors);
        }
      } catch {
        setValidationErrors({});
      }
    },
  });

  const deleteRecordMutation = useMutation({
    mutationFn: (recordId: number) => deleteRecord(projectId, selectedCollection!, recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.records(projectId, selectedCollection!) });
    },
  });

  const handleCreateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    createRecordMutation.mutate();
  };

  const fields = fieldsQuery.data || [];
  const records = recordsQuery.data?.records || [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Data"
        title="Data Explorer"
        description="Browse, create, and manage records in your collections"
        icon={<Table2 className="h-6 w-6" />}
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
                onClick={() => {
                  setSelectedCollection(collection.name);
                  setShowCreateForm(false);
                  setNewRecordData({});
                }}
              >
                <div className="flex items-center gap-2">
                  <Database className={`h-4 w-4 ${selectedCollection === collection.name ? "text-indigo-600" : "text-slate-400"}`} />
                  <div>
                    <div className="font-medium text-slate-900">{collection.display_name}</div>
                    <div className="text-xs text-slate-500 font-mono">{collection.name}</div>
                  </div>
                </div>
              </div>
            ))}
            {!collectionsQuery.data?.length && !collectionsQuery.isLoading && (
              <EmptyState
                icon={<Layers className="h-5 w-5" />}
                title="No collections"
                description="Create collections in Schema Builder first"
              />
            )}
          </div>
        </Card>

        {/* Data Table */}
        <Card padding="md" className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Records {selectedCollection && <span className="text-slate-500">• {selectedCollection}</span>}
            </h3>
            {selectedCollection && (
              <div className="flex items-center gap-2">
                {recordsQuery.data && <Badge tone="emerald">{recordsQuery.data.total} records</Badge>}
                <Button 
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  icon={showCreateForm ? undefined : <Plus className="h-4 w-4" />}
                  variant={showCreateForm ? "secondary" : "primary"}
                >
                  {showCreateForm ? "Cancel" : "New Record"}
                </Button>
              </div>
            )}
          </div>

          {selectedCollection ? (
            <>
              {/* Create Form */}
              {showCreateForm && (
                <form onSubmit={handleCreateRecord} className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="font-medium text-slate-900">Create New Record</h4>
                  
                  {Object.keys(validationErrors).length > 0 && (
                    <div className="flex items-start gap-2 text-rose-600 text-sm p-3 bg-rose-50 rounded-lg border border-rose-200">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium mb-1">Validation Errors:</p>
                        <ul className="list-disc list-inside">
                          {Object.entries(validationErrors).map(([fieldName, errors]) => (
                            <li key={fieldName}>
                              <strong>{fieldName}:</strong> {errors.join(", ")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  {fields.map((field: Field) => (
                    <FormField 
                      key={field.id} 
                      label={field.display_name}
                      hint={field.is_required ? "Required" : undefined}
                    >
                      {field.field_type === "relation" ? (
                        <RelationSelect
                          field={field}
                          projectId={projectId}
                          collections={collectionsQuery.data || []}
                          value={newRecordData[field.name] || ""}
                          onChange={(val) =>
                            setNewRecordData({ ...newRecordData, [field.name]: val })
                          }
                        />
                      ) : (
                        <Input
                          type={field.field_type === "int" || field.field_type === "float" ? "number" : "text"}
                          placeholder={`Enter ${field.display_name.toLowerCase()}`}
                          value={newRecordData[field.name] || ""}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewRecordData({ ...newRecordData, [field.name]: e.target.value })
                          }
                          className={validationErrors[field.name] ? "border-rose-500" : ""}
                        />
                      )}
                    </FormField>
                  ))}
                  <Button type="submit" loading={createRecordMutation.isPending} icon={<Plus className="h-4 w-4" />} className="w-full">
                    Create Record
                  </Button>
                </form>
              )}

              {/* Records Table */}
              {recordsQuery.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
                  ))}
                </div>
              ) : records.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          ID
                        </th>
                        {fields.map((field: Field) => (
                          <th
                            key={field.id}
                            className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider"
                          >
                            {field.display_name}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {records.map((record: DataRecord) => (
                        <tr key={String(record.id)} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-mono text-slate-900">{String(record.id)}</td>
                          {fields.map((field: Field) => (
                            <td key={field.id} className="px-4 py-3 text-sm text-slate-700">
                              {String(record[field.name] ?? "—")}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {record.created_at
                              ? new Date(String(record.created_at)).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => deleteRecordMutation.mutate(Number(record.id))}
                              disabled={deleteRecordMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={<Table2 className="h-6 w-6" />}
                  title="No records yet"
                  description="Create your first record using the form above"
                />
              )}
            </>
          ) : (
            <EmptyState
              icon={<Database className="h-6 w-6" />}
              title="Select a collection"
              description="Choose a collection from the left panel to view and manage its records"
            />
          )}
        </Card>
      </div>
    </div>
  );
}
