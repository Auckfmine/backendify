export const queryKeys = {
  me: ["me"] as const,
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  apiKeys: (projectId: string) => ["projects", projectId, "api-keys"] as const,
  collections: (projectId: string) => ["projects", projectId, "collections"] as const,
  collection: (projectId: string, name: string) => ["projects", projectId, "collections", name] as const,
  fields: (projectId: string, collectionName: string) => ["projects", projectId, "collections", collectionName, "fields"] as const,
  records: (projectId: string, collectionName: string) => ["projects", projectId, "data", collectionName] as const,
  auditEvents: (projectId: string) => ["projects", projectId, "audit", "events"] as const,
  schemaOps: (projectId: string) => ["projects", projectId, "audit", "schema-ops"] as const,
};
