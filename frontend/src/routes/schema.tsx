import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  Collection,
  Field,
  createCollection,
  createField,
  fetchCollections,
  fetchFields,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { Button, Card, Input, SectionTitle } from "../components/ui";

const FIELD_TYPES = ["string", "int", "float", "bool", "date", "datetime", "uuid"];

export default function SchemaPage() {
  const params = useRouterState({ select: (s) => s.matches.at(-1)?.params }) as { projectId: string } | undefined;
  const projectId = params?.projectId ?? "";
  const queryClient = useQueryClient();

  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDisplayName, setNewCollectionDisplayName] = useState("");
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldDisplayName, setNewFieldDisplayName] = useState("");
  const [newFieldType, setNewFieldType] = useState("string");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldUnique, setNewFieldUnique] = useState(false);
  const [newFieldIndexed, setNewFieldIndexed] = useState(false);
  const [newFieldDefault, setNewFieldDefault] = useState("");

  const collectionsQuery = useQuery({
    queryKey: queryKeys.collections(projectId),
    queryFn: () => fetchCollections(projectId),
  });

  const fieldsQuery = useQuery({
    queryKey: queryKeys.fields(projectId, selectedCollection || ""),
    queryFn: () => fetchFields(projectId, selectedCollection!),
    enabled: !!selectedCollection,
  });

  const createCollectionMutation = useMutation({
    mutationFn: () => createCollection(projectId, newCollectionName, newCollectionDisplayName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections(projectId) });
      setNewCollectionName("");
      setNewCollectionDisplayName("");
    },
  });

  const createFieldMutation = useMutation({
    mutationFn: () =>
      createField(projectId, selectedCollection!, {
        name: newFieldName,
        display_name: newFieldDisplayName,
        field_type: newFieldType,
        is_required: newFieldRequired,
        is_unique: newFieldUnique,
        is_indexed: newFieldIndexed,
        default_value: newFieldDefault || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fields(projectId, selectedCollection!) });
      setNewFieldName("");
      setNewFieldDisplayName("");
      setNewFieldType("string");
      setNewFieldRequired(false);
      setNewFieldUnique(false);
      setNewFieldIndexed(false);
      setNewFieldDefault("");
    },
  });

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCollectionName && newCollectionDisplayName) {
      createCollectionMutation.mutate();
    }
  };

  const handleCreateField = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFieldName && newFieldDisplayName && selectedCollection) {
      createFieldMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle>Schema Builder</SectionTitle>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collections Panel */}
        <Card>
          <h3 className="text-lg font-semibold mb-4">Collections</h3>

          <form onSubmit={handleCreateCollection} className="space-y-3 mb-4">
            <Input
              placeholder="Collection name (e.g., posts)"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            />
            <Input
              placeholder="Display name (e.g., Blog Posts)"
              value={newCollectionDisplayName}
              onChange={(e) => setNewCollectionDisplayName(e.target.value)}
            />
            <Button type="submit" disabled={createCollectionMutation.isPending}>
              {createCollectionMutation.isPending ? "Creating..." : "Create Collection"}
            </Button>
          </form>

          {collectionsQuery.isLoading && <p className="text-gray-500">Loading...</p>}
          {collectionsQuery.error && <p className="text-red-500">Error loading collections</p>}

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
          </div>
        </Card>

        {/* Fields Panel */}
        <Card>
          <h3 className="text-lg font-semibold mb-4">
            Fields {selectedCollection && <span className="text-gray-500">({selectedCollection})</span>}
          </h3>

          {selectedCollection ? (
            <>
              <form onSubmit={handleCreateField} className="space-y-3 mb-4">
                <Input
                  placeholder="Field name (e.g., title)"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                />
                <Input
                  placeholder="Display name (e.g., Title)"
                  value={newFieldDisplayName}
                  onChange={(e) => setNewFieldDisplayName(e.target.value)}
                />
                <select
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value)}
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={newFieldRequired}
                      onChange={(e) => setNewFieldRequired(e.target.checked)}
                    />
                    Required
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={newFieldUnique}
                      onChange={(e) => setNewFieldUnique(e.target.checked)}
                    />
                    Unique
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={newFieldIndexed}
                      onChange={(e) => setNewFieldIndexed(e.target.checked)}
                    />
                    Indexed
                  </label>
                </div>
                {newFieldRequired && (
                  <Input
                    placeholder="Default value (required for existing rows)"
                    value={newFieldDefault}
                    onChange={(e) => setNewFieldDefault(e.target.value)}
                  />
                )}
                <Button type="submit" disabled={createFieldMutation.isPending}>
                  {createFieldMutation.isPending ? "Adding..." : "Add Field"}
                </Button>
              </form>

              {fieldsQuery.isLoading && <p className="text-gray-500">Loading fields...</p>}
              {fieldsQuery.error && <p className="text-red-500">Error loading fields</p>}

              <div className="space-y-2">
                {/* System fields */}
                <div className="p-3 bg-gray-100 rounded-lg opacity-60">
                  <div className="flex justify-between">
                    <span className="font-medium">id</span>
                    <span className="text-sm text-gray-500">bigint (auto)</span>
                  </div>
                </div>
                <div className="p-3 bg-gray-100 rounded-lg opacity-60">
                  <div className="flex justify-between">
                    <span className="font-medium">created_at</span>
                    <span className="text-sm text-gray-500">datetime (auto)</span>
                  </div>
                </div>
                <div className="p-3 bg-gray-100 rounded-lg opacity-60">
                  <div className="flex justify-between">
                    <span className="font-medium">updated_at</span>
                    <span className="text-sm text-gray-500">datetime (auto)</span>
                  </div>
                </div>

                {/* User-defined fields */}
                {fieldsQuery.data?.map((field: Field) => (
                  <div key={field.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between">
                      <span className="font-medium">{field.display_name}</span>
                      <span className="text-sm text-gray-500">{field.field_type}</span>
                    </div>
                    <div className="text-sm text-gray-500">{field.name}</div>
                    <div className="flex gap-2 mt-1">
                      {field.is_required && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">required</span>
                      )}
                      {field.is_unique && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">unique</span>
                      )}
                      {field.is_indexed && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">indexed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-500">Select a collection to manage its fields</p>
          )}
        </Card>
      </div>
    </div>
  );
}
