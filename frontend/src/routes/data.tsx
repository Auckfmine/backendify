import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
import { Button, Card, Input, SectionTitle } from "../components/ui";

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

  const records = recordsQuery.data?.data || [];

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
  const records = recordsQuery.data?.data || [];

  return (
    <div className="space-y-6">
      <SectionTitle>Data Explorer</SectionTitle>

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
                onClick={() => {
                  setSelectedCollection(collection.name);
                  setShowCreateForm(false);
                  setNewRecordData({});
                }}
              >
                <div className="font-medium">{collection.display_name}</div>
                <div className="text-sm text-gray-500">{collection.name}</div>
              </div>
            ))}
            {!collectionsQuery.data?.length && !collectionsQuery.isLoading && (
              <p className="text-sm text-gray-500">No collections yet</p>
            )}
          </div>
        </Card>

        {/* Data Table */}
        <Card className="lg:col-span-3">
          {selectedCollection ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">{selectedCollection}</h3>
                <Button onClick={() => setShowCreateForm(!showCreateForm)}>
                  {showCreateForm ? "Cancel" : "New Record"}
                </Button>
              </div>

              {/* Create Form */}
              {showCreateForm && (
                <form onSubmit={handleCreateRecord} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3">
                  <h4 className="font-medium">Create New Record</h4>
                  
                  {Object.keys(validationErrors).length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-red-700 font-medium text-sm mb-2">Validation Errors:</p>
                      <ul className="text-red-600 text-sm list-disc list-inside">
                        {Object.entries(validationErrors).map(([fieldName, errors]) => (
                          <li key={fieldName}>
                            <strong>{fieldName}:</strong> {errors.join(", ")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {fields.map((field: Field) => (
                    <div key={field.id}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.display_name}
                        {field.is_required && <span className="text-red-500 ml-1">*</span>}
                      </label>
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
                          placeholder={`${field.name} (${field.field_type})`}
                          value={newRecordData[field.name] || ""}
                          onChange={(e) =>
                            setNewRecordData({ ...newRecordData, [field.name]: e.target.value })
                          }
                          className={validationErrors[field.name] ? "border-red-500" : ""}
                        />
                      )}
                      {validationErrors[field.name] && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors[field.name].join(", ")}</p>
                      )}
                    </div>
                  ))}
                  <Button type="submit" disabled={createRecordMutation.isPending}>
                    {createRecordMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </form>
              )}

              {/* Records Table */}
              {recordsQuery.isLoading ? (
                <p className="text-gray-500">Loading records...</p>
              ) : records.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          ID
                        </th>
                        {fields.map((field: Field) => (
                          <th
                            key={field.id}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                          >
                            {field.display_name}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Created
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {records.map((record: DataRecord) => (
                        <tr key={String(record.id)} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{String(record.id)}</td>
                          {fields.map((field: Field) => (
                            <td key={field.id} className="px-4 py-3 text-sm text-gray-900">
                              {String(record[field.name] ?? "")}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {record.created_at
                              ? new Date(String(record.created_at)).toLocaleString()
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              className="bg-red-600 hover:bg-red-700 text-xs px-2 py-1"
                              onClick={() => deleteRecordMutation.mutate(Number(record.id))}
                              disabled={deleteRecordMutation.isPending}
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500">No records yet</p>
              )}

              {recordsQuery.data && (
                <p className="mt-4 text-sm text-gray-500">
                  Total: {recordsQuery.data.total} records
                </p>
              )}
            </>
          ) : (
            <p className="text-gray-500">Select a collection to view data</p>
          )}
        </Card>
      </div>
    </div>
  );
}
