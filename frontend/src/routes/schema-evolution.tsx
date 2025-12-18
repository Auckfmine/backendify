import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";
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
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Schema Evolution</h1>
      
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Select Collection</h2>
          <select
            className="w-full border rounded px-3 py-2 mb-4"
            value={selectedCollection?.id || ""}
            onChange={(e) => {
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
          </select>

          {selectedCollection && (
            <>
              <h3 className="font-medium mb-2">Fields</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {fieldsQuery.data?.map((f) => (
                  <div
                    key={f.id}
                    className={`p-2 rounded cursor-pointer ${
                      selectedField?.id === f.id ? "bg-blue-100" : "hover:bg-gray-100"
                    }`}
                    onClick={() => setSelectedField(f)}
                  >
                    <span className="font-medium">{f.display_name}</span>
                    <span className="text-gray-500 text-sm ml-2">({f.name}: {f.field_type})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Operation</h2>
          <select
            className="w-full border rounded px-3 py-2 mb-4"
            value={operation}
            onChange={(e) => {
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
          </select>

          {(operation === "rename_collection" || operation === "rename_field") && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">New Name (slug)</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., new_name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">New Display Name (optional)</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="e.g., New Name"
                />
              </div>
            </div>
          )}

          {operation === "change_field_type" && (
            <div>
              <label className="block text-sm font-medium mb-1">New Type</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
              >
                <option value="">-- Select Type --</option>
                {conversionsQuery.data?.safe_conversions
                  .filter((c) => c.from === selectedField?.field_type)
                  .map((c) => (
                    <option key={c.to} value={c.to}>
                      {c.to} - {c.description}
                    </option>
                  ))}
              </select>
              {selectedField && conversionsQuery.data?.safe_conversions.filter((c) => c.from === selectedField.field_type).length === 0 && (
                <p className="text-sm text-gray-500 mt-2">No safe conversions available for type "{selectedField.field_type}"</p>
              )}
            </div>
          )}

          {(operation === "soft_delete_field" || operation === "hard_delete_field") && selectedField && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
              {operation === "soft_delete_field" ? (
                <p>This will hide the field from the UI and block writes. Data is preserved.</p>
              ) : (
                <p className="text-red-600 font-medium">
                  WARNING: This will permanently delete all data in this column!
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
              onClick={handlePreview}
              disabled={!operation || isLoading}
            >
              Preview
            </button>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              onClick={handleApply}
              disabled={!operation || isLoading}
            >
              {isLoading ? "Applying..." : "Apply"}
            </button>
          </div>
        </div>
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
