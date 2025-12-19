import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  Database,
  Plus,
  Table,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  Key,
  Layers,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  Collection,
  Field,
  createCollection,
  createField,
  fetchCollections,
  fetchFields,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import {
  Button,
  Card,
  Input,
  PageHeader,
  Badge,
  FormField,
  Select,
  EmptyState,
} from "../components/ui";

const FIELD_TYPES = ["string", "int", "float", "bool", "date", "datetime", "uuid"];

const FIELD_TYPE_ICONS: Record<string, React.ReactNode> = {
  string: <Type className="h-4 w-4" />,
  int: <Hash className="h-4 w-4" />,
  float: <Hash className="h-4 w-4" />,
  bool: <ToggleLeft className="h-4 w-4" />,
  date: <Calendar className="h-4 w-4" />,
  datetime: <Calendar className="h-4 w-4" />,
  uuid: <Key className="h-4 w-4" />,
};

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
      <PageHeader
        eyebrow="Schema"
        title="Schema Builder"
        description="Design your data model with collections and fields"
        variant="gradient"
        icon={<Database className="h-6 w-6" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collections Panel */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Collections</h3>
            <Badge tone="indigo">{collectionsQuery.data?.length || 0} tables</Badge>
          </div>

          <form onSubmit={handleCreateCollection} className="space-y-3 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <FormField label="Collection name">
              <Input
                placeholder="e.g., posts"
                value={newCollectionName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCollectionName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              />
            </FormField>
            <FormField label="Display name">
              <Input
                placeholder="e.g., Blog Posts"
                value={newCollectionDisplayName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCollectionDisplayName(e.target.value)}
              />
            </FormField>
            <Button type="submit" loading={createCollectionMutation.isPending} icon={<Plus className="h-4 w-4" />} className="w-full">
              Create Collection
            </Button>
          </form>

          {collectionsQuery.isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          )}

          {collectionsQuery.error && (
            <div className="flex items-center gap-2 text-rose-600 text-sm p-3 bg-rose-50 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              Error loading collections
            </div>
          )}

          {!collectionsQuery.isLoading && collectionsQuery.data?.length === 0 && (
            <EmptyState
              icon={<Layers className="h-6 w-6" />}
              title="No collections yet"
              description="Create your first collection to start building your schema"
            />
          )}

          <div className="space-y-2">
            {collectionsQuery.data?.map((collection: Collection) => (
              <div
                key={collection.id}
                className={`p-4 rounded-xl cursor-pointer transition-all border-2 ${
                  selectedCollection === collection.name
                    ? "bg-indigo-50 border-indigo-300 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                }`}
                onClick={() => setSelectedCollection(collection.name)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${selectedCollection === collection.name ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>
                    <Table className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{collection.display_name}</div>
                    <div className="text-sm text-slate-500 font-mono">{collection.name}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Fields Panel */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Fields {selectedCollection && <span className="text-slate-500">• {selectedCollection}</span>}
            </h3>
            {fieldsQuery.data && <Badge tone="emerald">{fieldsQuery.data.length} fields</Badge>}
          </div>

          {selectedCollection ? (
            <>
              <form onSubmit={handleCreateField} className="space-y-3 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <FormField label="Field name">
                  <Input
                    placeholder="e.g., title"
                    value={newFieldName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFieldName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  />
                </FormField>
                <FormField label="Display name">
                  <Input
                    placeholder="e.g., Title"
                    value={newFieldDisplayName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFieldDisplayName(e.target.value)}
                  />
                </FormField>
                <FormField label="Field type">
                  <Select
                    value={newFieldType}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewFieldType(e.target.value)}
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newFieldRequired}
                      onChange={(e) => setNewFieldRequired(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-700">Required</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newFieldUnique}
                      onChange={(e) => setNewFieldUnique(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-700">Unique</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newFieldIndexed}
                      onChange={(e) => setNewFieldIndexed(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-700">Indexed</span>
                  </label>
                </div>
                {newFieldRequired && (
                  <FormField label="Default value" hint="Required for existing rows">
                    <Input
                      placeholder="Default value"
                      value={newFieldDefault}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFieldDefault(e.target.value)}
                    />
                  </FormField>
                )}
                <Button type="submit" loading={createFieldMutation.isPending} icon={<Plus className="h-4 w-4" />} className="w-full">
                  Add Field
                </Button>
              </form>

              {fieldsQuery.isLoading && (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              )}

              {fieldsQuery.error && (
                <div className="flex items-center gap-2 text-rose-600 text-sm p-3 bg-rose-50 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  Error loading fields
                </div>
              )}

              <div className="space-y-2">
                {/* System fields */}
                {["id", "created_at", "updated_at"].map((name) => (
                  <div key={name} className="p-3 bg-slate-100 rounded-xl opacity-70">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-slate-200 text-slate-500">
                          {name === "id" ? <Hash className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
                        </div>
                        <span className="font-medium text-slate-700 font-mono text-sm">{name}</span>
                      </div>
                      <Badge tone="slate">{name === "id" ? "bigint" : "datetime"}</Badge>
                    </div>
                  </div>
                ))}

                {/* User-defined fields */}
                {fieldsQuery.data?.map((field: Field) => (
                  <div key={field.id} className="p-3 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600">
                          {FIELD_TYPE_ICONS[field.field_type] || <Type className="h-3.5 w-3.5" />}
                        </div>
                        <div>
                          <span className="font-medium text-slate-900">{field.display_name}</span>
                          <span className="text-slate-400 font-mono text-xs ml-2">{field.name}</span>
                        </div>
                      </div>
                      <Badge tone="indigo">{field.field_type}</Badge>
                    </div>
                    {(field.is_required || field.is_unique || field.is_indexed) && (
                      <div className="flex gap-2 mt-2 ml-9">
                        {field.is_required && <Badge tone="rose">required</Badge>}
                        {field.is_unique && <Badge tone="purple">unique</Badge>}
                        {field.is_indexed && <Badge tone="blue">indexed</Badge>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={<Database className="h-6 w-6" />}
              title="Select a collection"
              description="Choose a collection from the left panel to manage its fields"
            />
          )}
        </Card>
      </div>
    </div>
  );
}
