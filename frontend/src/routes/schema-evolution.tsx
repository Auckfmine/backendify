import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";
import { GitMerge, RefreshCw, Trash2, RotateCcw, AlertTriangle, ArrowRight } from "lucide-react";
import {
  changeFieldType,
  fetchActiveAliases,
  fetchCollections,
  fetchFields,
  fetchSafeConversions,
  hardDeleteField,
  previewMigration,
  renameCollection,
  renameField,
  restoreField,
  softDeleteField,
  type Collection,
  type Field,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { Button, Card, Input, PageHeader, Badge, FormField, Select, EmptyState } from "../components/ui";

export default function SchemaEvolutionPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const queryClient = useQueryClient();

  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [operation, setOperation] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newType, setNewType] = useState("");
  const [previewResult, setPreviewResult] = useState<{ steps: string[]; warnings: string[] } | null>(null);
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

  const aliasesQuery = useQuery({
    queryKey: ["aliases", projectId],
    queryFn: () => fetchActiveAliases(projectId),
  });

  const conversionsQuery = useQuery({
    queryKey: ["safe-conversions", projectId],
    queryFn: () => fetchSafeConversions(projectId),
  });

  const renameCollectionMutation = useMutation({
    mutationFn: () => renameCollection(projectId, selectedCollection!.id, newName, newDisplayName || undefined),
    onSuccess: (data) => {
      setSuccess(`Collection renamed successfully. Old name aliased until ${data.details.alias_expires_at}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.collections(projectId) });
      queryClient.invalidateQueries({ queryKey: ["aliases", projectId] });
      resetForm();
    },
    onError: (err: Error) => setError(err.message),
  });

  const renameFieldMutation = useMutation({
    mutationFn: () => renameField(projectId, selectedCollection!.id, selectedField!.id, newName, newDisplayName || undefined),
    onSuccess: (data) => {
      setSuccess(`Field renamed successfully. Old name aliased until ${data.details.alias_expires_at}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.fields(projectId, selectedCollection!.name) });
      queryClient.invalidateQueries({ queryKey: ["aliases", projectId] });
      resetForm();
    },
    onError: (err: Error) => setError(err.message),
  });

  const softDeleteMutation = useMutation({
    mutationFn: () => softDeleteField(projectId, selectedCollection!.id, selectedField!.id),
    onSuccess: () => {
      setSuccess("Field soft-deleted. It is now hidden and writes are blocked.");
      queryClient.invalidateQueries({ queryKey: queryKeys.fields(projectId, selectedCollection!.name) });
      resetForm();
    },
    onError: (err: Error) => setError(err.message),
  });

  const hardDeleteMutation = useMutation({
    mutationFn: () => hardDeleteField(projectId, selectedCollection!.id, selectedField!.id, true),
    onSuccess: () => {
      setSuccess("Field permanently deleted.");
      queryClient.invalidateQueries({ queryKey: queryKeys.fields(projectId, selectedCollection!.name) });
      resetForm();
    },
    onError: (err: Error) => setError(err.message),
  });

  const restoreMutation = useMutation({
    mutationFn: () => restoreField(projectId, selectedCollection!.id, selectedField!.id),
    onSuccess: () => {
      setSuccess("Field restored successfully.");
      queryClient.invalidateQueries({ queryKey: queryKeys.fields(projectId, selectedCollection!.name) });
      resetForm();
    },
    onError: (err: Error) => setError(err.message),
  });

  const changeTypeMutation = useMutation({
    mutationFn: () => changeFieldType(projectId, selectedCollection!.id, selectedField!.id, newType),
    onSuccess: (data) => {
      setSuccess(`Field type changed from ${data.details.old_type} to ${data.details.new_type}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.fields(projectId, selectedCollection!.name) });
      resetForm();
    },
    onError: (err: Error) => setError(err.message),
  });

  const resetForm = () => {
    setOperation("");
    setNewName("");
    setNewDisplayName("");
    setNewType("");
    setSelectedField(null);
    setPreviewResult(null);
  };

  const handlePreview = async () => {
    if (!selectedCollection) return;
    setError(null);
    
    try {
      let params: Record<string, unknown> = {};
      if (operation === "rename_collection") {
        params = { new_name: newName };
      } else if (operation === "rename_field" && selectedField) {
        params = { field_id: selectedField.id, new_name: newName };
      } else if (operation === "soft_delete_field" && selectedField) {
        params = { field_id: selectedField.id };
      } else if (operation === "hard_delete_field" && selectedField) {
        params = { field_id: selectedField.id };
      } else if (operation === "change_field_type" && selectedField) {
        params = { field_id: selectedField.id, new_type: newType };
      }
      
      const result = await previewMigration(projectId, selectedCollection.id, operation, params);
      setPreviewResult({ steps: result.steps, warnings: result.warnings });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    }
  };

  const handleApply = () => {
    setError(null);
    setSuccess(null);
    
    switch (operation) {
      case "rename_collection":
        renameCollectionMutation.mutate();
        break;
      case "rename_field":
        renameFieldMutation.mutate();
        break;
      case "soft_delete_field":
        softDeleteMutation.mutate();
        break;
      case "hard_delete_field":
        hardDeleteMutation.mutate();
        break;
      case "restore_field":
        restoreMutation.mutate();
        break;
      case "change_field_type":
        changeTypeMutation.mutate();
        break;
    }
  };

  const isLoading = renameCollectionMutation.isPending || renameFieldMutation.isPending || 
    softDeleteMutation.isPending || hardDeleteMutation.isPending || 
    restoreMutation.isPending || changeTypeMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Schema"
        title="Schema Evolution"
        description="Safely migrate and evolve your data schema"
        icon={<GitMerge className="h-6 w-6" />}
      />
      
      {error && (
        <div className="flex items-center gap-2 text-rose-600 text-sm p-3 bg-rose-50 rounded-xl border border-rose-200">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}
      
      {success && (
        <div className="flex items-center gap-2 text-emerald-600 text-sm p-3 bg-emerald-50 rounded-xl border border-emerald-200">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Collection & Fields Panel */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Select Collection</h2>
            <Badge tone="indigo">{collectionsQuery.data?.length || 0}</Badge>
          </div>
          <Select
            value={selectedCollection?.id || ""}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              const coll = collectionsQuery.data?.find((c) => c.id === e.target.value);
              setSelectedCollection(coll || null);
              setSelectedField(null);
              resetForm();
            }}
          >
            <option value="">-- Select Collection --</option>
            {collectionsQuery.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name} ({c.name})
              </option>
            ))}
          </Select>

          {selectedCollection && (
            <div className="mt-4">
              <h3 className="font-medium text-slate-900 mb-2">Fields</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {fieldsQuery.data?.map((f) => (
                  <div
                    key={f.id}
                    className={`p-3 rounded-xl cursor-pointer transition-all border-2 ${
                      selectedField?.id === f.id
                        ? "bg-indigo-50 border-indigo-300 shadow-sm"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                    onClick={() => setSelectedField(f)}
                  >
                    <span className="font-medium text-slate-900">{f.display_name}</span>
                    <span className="text-slate-500 text-sm ml-2">({f.name}: {f.field_type})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Operation Panel */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Operation</h2>
          </div>
          <Select
            value={operation}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setOperation(e.target.value);
              setPreviewResult(null);
            }}
            disabled={!selectedCollection}
          >
            <option value="">-- Select Operation --</option>
            <optgroup label="Collection Operations">
              <option value="rename_collection">Rename Collection</option>
            </optgroup>
            <optgroup label="Field Operations">
              <option value="rename_field" disabled={!selectedField}>Rename Field</option>
              <option value="soft_delete_field" disabled={!selectedField}>Soft Delete Field</option>
              <option value="hard_delete_field" disabled={!selectedField}>Hard Delete Field</option>
              <option value="restore_field" disabled={!selectedField}>Restore Field</option>
              <option value="change_field_type" disabled={!selectedField}>Change Field Type</option>
            </optgroup>
          </Select>

          {(operation === "rename_collection" || operation === "rename_field") && (
            <div className="space-y-3 mt-4">
              <FormField label="New Name (slug)">
                <Input
                  value={newName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
                  placeholder="e.g., new_name"
                />
              </FormField>
              <FormField label="New Display Name" hint="Optional">
                <Input
                  value={newDisplayName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDisplayName(e.target.value)}
                  placeholder="e.g., New Name"
                />
              </FormField>
            </div>
          )}

          {operation === "change_field_type" && (
            <div className="mt-4">
              <FormField label="New Type">
                <Select
                  value={newType}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewType(e.target.value)}
                >
                  <option value="">-- Select Type --</option>
                  {conversionsQuery.data?.safe_conversions
                    .filter((c) => c.from === selectedField?.field_type)
                    .map((c) => (
                      <option key={c.to} value={c.to}>
                        {c.to} - {c.description}
                      </option>
                    ))}
                </Select>
              </FormField>
              {selectedField && conversionsQuery.data?.safe_conversions.filter((c) => c.from === selectedField.field_type).length === 0 && (
                <p className="text-sm text-slate-500 mt-2">No safe conversions available for type "{selectedField.field_type}"</p>
              )}
            </div>
          )}

          {(operation === "soft_delete_field" || operation === "hard_delete_field") && selectedField && (
            <div className={`mt-4 p-3 rounded-xl text-sm ${operation === "soft_delete_field" ? "bg-amber-50 border border-amber-200" : "bg-rose-50 border border-rose-200"}`}>
              {operation === "soft_delete_field" ? (
                <p className="text-amber-800">This will hide the field from the UI and block writes. Data is preserved.</p>
              ) : (
                <p className="text-rose-600 font-medium">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  WARNING: This will permanently delete all data in this column!
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button
              variant="secondary"
              onClick={handlePreview}
              disabled={!operation || isLoading}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Preview
            </Button>
            <Button
              onClick={handleApply}
              disabled={!operation || isLoading}
              loading={isLoading}
              icon={<ArrowRight className="h-4 w-4" />}
            >
              Apply
            </Button>
          </div>
        </Card>
      </div>

      {previewResult && (
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Migration Preview</h2>
          
          {previewResult.warnings.length > 0 && (
            <div className="mb-4">
              <h3 className="font-medium text-yellow-600 mb-2">Warnings</h3>
              <ul className="list-disc list-inside text-sm text-yellow-700">
                {previewResult.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          
          <h3 className="font-medium mb-2">DDL Steps</h3>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
            {previewResult.steps.join("\n")}
          </pre>
        </div>
      )}

      <div className="mt-6 bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4">Active Aliases</h2>
        {aliasesQuery.data?.collection_aliases.length === 0 && aliasesQuery.data?.field_aliases.length === 0 ? (
          <p className="text-gray-500">No active aliases</p>
        ) : (
          <div className="space-y-4">
            {aliasesQuery.data?.collection_aliases.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Collection Aliases</h3>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Old Name</th>
                      <th className="text-left p-2">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aliasesQuery.data.collection_aliases.map((a, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-mono">{a.old_name}</td>
                        <td className="p-2">{a.expires_at ? new Date(a.expires_at).toLocaleDateString() : "Never"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {aliasesQuery.data?.field_aliases.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Field Aliases</h3>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Old Name</th>
                      <th className="text-left p-2">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aliasesQuery.data.field_aliases.map((a, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-mono">{a.old_name}</td>
                        <td className="p-2">{a.expires_at ? new Date(a.expires_at).toLocaleDateString() : "Never"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
