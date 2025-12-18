import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!getRefreshToken()) return null;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: getRefreshToken() }),
        });
        if (!res.ok) {
          clearTokens();
          return null;
        }
        const data = await res.json();
        setTokens(data.access_token, data.refresh_token);
        return data.access_token as string;
      } catch (err) {
        clearTokens();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, options, false);
    }
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || "Request failed");
  }
  if (res.status === 204) {
    // @ts-expect-error allow void
    return undefined;
  }
  return (await res.json()) as T;
}

export async function register(email: string, password: string) {
  const data = await request<{ access_token: string; refresh_token: string }>(`/api/auth/register`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function login(email: string, password: string) {
  const data = await request<{ access_token: string; refresh_token: string }>(`/api/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function logout() {
  const refresh = getRefreshToken();
  if (!refresh) {
    clearTokens();
    return;
  }
  await request<void>(`/api/auth/logout`, {
    method: "POST",
    body: JSON.stringify({ refresh_token: refresh }),
  }).catch(() => undefined);
  clearTokens();
}

export async function fetchMe() {
  return request<{ id: string; email: string }>(`/api/me`);
}

export type Project = { id: string; name: string };

export async function fetchProjects(): Promise<Project[]> {
  return request<Project[]>(`/api/projects`);
}

export async function createProject(name: string): Promise<Project> {
  return request<Project>(`/api/projects`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function fetchProject(projectId: string): Promise<Project> {
  return request<Project>(`/api/projects/${projectId}`);
}

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  revoked: boolean;
  created_at: string;
};

export async function fetchApiKeys(projectId: string): Promise<ApiKey[]> {
  return request<ApiKey[]>(`/api/projects/${projectId}/api-keys`);
}

export async function createApiKey(
  projectId: string,
  name: string,
): Promise<{ id: string; name: string; prefix: string; api_key: string }> {
  return request(`/api/projects/${projectId}/api-keys`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function revokeApiKey(projectId: string, apiKeyId: string) {
  return request<void>(`/api/projects/${projectId}/api-keys/${apiKeyId}/revoke`, {
    method: "POST",
  });
}

// Collections
export type Collection = {
  id: string;
  name: string;
  display_name: string;
  sql_table_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function fetchCollections(projectId: string): Promise<Collection[]> {
  return request<Collection[]>(`/api/projects/${projectId}/schema/collections`);
}

export async function createCollection(
  projectId: string,
  name: string,
  displayName: string,
): Promise<Collection> {
  return request<Collection>(`/api/projects/${projectId}/schema/collections`, {
    method: "POST",
    body: JSON.stringify({ name, display_name: displayName }),
  });
}

export async function fetchCollection(projectId: string, collectionName: string): Promise<Collection> {
  return request<Collection>(`/api/projects/${projectId}/schema/collections/${collectionName}`);
}

// Fields
export type Field = {
  id: string;
  name: string;
  display_name: string;
  field_type: string;
  sql_column_name: string;
  is_required: boolean;
  is_unique: boolean;
  is_indexed: boolean;
  default_value: string | null;
  relation_target_collection_id: string | null;
  relation_type: string | null;
  relation_on_delete: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchFields(projectId: string, collectionName: string): Promise<Field[]> {
  return request<Field[]>(`/api/projects/${projectId}/schema/collections/${collectionName}/fields`);
}

export async function createField(
  projectId: string,
  collectionName: string,
  field: {
    name: string;
    display_name: string;
    field_type: string;
    is_required?: boolean;
    is_unique?: boolean;
    is_indexed?: boolean;
    default_value?: string;
  },
): Promise<Field> {
  return request<Field>(`/api/projects/${projectId}/schema/collections/${collectionName}/fields`, {
    method: "POST",
    body: JSON.stringify(field),
  });
}

// Data CRUD
export type DataRecord = Record<string, unknown>;

export type DataListResponse = {
  data: DataRecord[];
  total: number;
  limit: number;
  offset: number;
};

export async function fetchRecords(
  projectId: string,
  collectionName: string,
  limit = 100,
  offset = 0,
): Promise<DataListResponse> {
  return request<DataListResponse>(
    `/api/projects/${projectId}/data/${collectionName}?limit=${limit}&offset=${offset}`,
  );
}

export async function createRecord(
  projectId: string,
  collectionName: string,
  data: DataRecord,
): Promise<DataRecord> {
  return request<DataRecord>(`/api/projects/${projectId}/data/${collectionName}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchRecord(
  projectId: string,
  collectionName: string,
  recordId: number,
): Promise<DataRecord> {
  return request<DataRecord>(`/api/projects/${projectId}/data/${collectionName}/${recordId}`);
}

export async function updateRecord(
  projectId: string,
  collectionName: string,
  recordId: number,
  data: DataRecord,
): Promise<DataRecord> {
  return request<DataRecord>(`/api/projects/${projectId}/data/${collectionName}/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteRecord(
  projectId: string,
  collectionName: string,
  recordId: number,
): Promise<void> {
  return request<void>(`/api/projects/${projectId}/data/${collectionName}/${recordId}`, {
    method: "DELETE",
  });
}

// Audit
export type AuditEvent = {
  id: string;
  project_id: string;
  collection_id: string | null;
  record_id: string | null;
  action: string;
  actor_user_id: string | null;
  actor_api_key_id: string | null;
  actor_app_user_id: string | null;
  old_data_json: string | null;
  new_data_json: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type SchemaOp = {
  id: string;
  project_id: string;
  collection_id: string | null;
  op_type: string;
  payload_json: string;
  status: string;
  error: string | null;
  actor_user_id: string | null;
  created_at: string;
};

export type AuditEventsResponse = {
  events: AuditEvent[];
  total: number;
  limit: number;
  offset: number;
};

export type AuditEventFilters = {
  collection_id?: string;
  record_id?: string;
  action?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  actor_type?: string;
  limit?: number;
  offset?: number;
};

export async function fetchAuditEvents(
  projectId: string,
  params?: AuditEventFilters,
): Promise<AuditEventsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.collection_id) searchParams.set("collection_id", params.collection_id);
  if (params?.record_id) searchParams.set("record_id", params.record_id);
  if (params?.action) searchParams.set("action", params.action);
  if (params?.start_date) searchParams.set("start_date", params.start_date);
  if (params?.end_date) searchParams.set("end_date", params.end_date);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.actor_type) searchParams.set("actor_type", params.actor_type);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  const query = searchParams.toString();
  return request<AuditEventsResponse>(`/api/projects/${projectId}/audit/events${query ? `?${query}` : ""}`);
}

export async function fetchSchemaOps(
  projectId: string,
  params?: { collection_id?: string; op_type?: string; limit?: number; offset?: number },
): Promise<SchemaOp[]> {
  const searchParams = new URLSearchParams();
  if (params?.collection_id) searchParams.set("collection_id", params.collection_id);
  if (params?.op_type) searchParams.set("op_type", params.op_type);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  const query = searchParams.toString();
  return request<SchemaOp[]>(`/api/projects/${projectId}/audit/schema-ops${query ? `?${query}` : ""}`);
}

// Policies
export type Policy = {
  id: string;
  collection_id: string;
  name: string;
  action: string;
  effect: string;
  condition_json: string | null;
  is_active: boolean;
  priority: number;
  allowed_principals: string | null;  // comma-separated: "admin_user,app_user,api_key,anonymous"
  require_email_verified: boolean;
  created_at: string;
  updated_at: string;
};

export type PolicyCreate = {
  name: string;
  action: string;
  effect?: string;
  condition_json?: string;
  priority?: number;
  allowed_principals?: string;
  require_email_verified?: boolean;
};

export async function fetchPolicies(projectId: string, collectionName: string): Promise<Policy[]> {
  return request<Policy[]>(`/api/projects/${projectId}/schema/collections/${collectionName}/policies`);
}

export async function createPolicy(
  projectId: string,
  collectionName: string,
  policy: PolicyCreate,
): Promise<Policy> {
  return request<Policy>(`/api/projects/${projectId}/schema/collections/${collectionName}/policies`, {
    method: "POST",
    body: JSON.stringify(policy),
  });
}

export async function deletePolicy(projectId: string, collectionName: string, policyId: string): Promise<void> {
  return request<void>(`/api/projects/${projectId}/schema/collections/${collectionName}/policies/${policyId}`, {
    method: "DELETE",
  });
}

// Webhooks
export type Webhook = {
  id: string;
  project_id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  secret_hash: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchWebhooks(projectId: string): Promise<Webhook[]> {
  return request<Webhook[]>(`/api/projects/${projectId}/webhooks`);
}

export async function createWebhook(
  projectId: string,
  webhook: { name: string; url: string; events: string[] },
): Promise<Webhook & { secret: string }> {
  return request<Webhook & { secret: string }>(`/api/projects/${projectId}/webhooks`, {
    method: "POST",
    body: JSON.stringify(webhook),
  });
}

export async function deleteWebhook(projectId: string, webhookId: string): Promise<void> {
  return request<void>(`/api/projects/${projectId}/webhooks/${webhookId}`, {
    method: "DELETE",
  });
}

// Workflows
export type WorkflowStep = {
  action: string;
  config?: Record<string, unknown>;
};

export type Workflow = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  steps: WorkflowStep[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function fetchWorkflows(projectId: string): Promise<Workflow[]> {
  return request<Workflow[]>(`/api/projects/${projectId}/workflows`);
}

export async function createWorkflow(
  projectId: string,
  workflow: {
    name: string;
    description?: string;
    trigger_type: string;
    trigger_config?: Record<string, unknown>;
    steps?: WorkflowStep[];
  },
): Promise<Workflow> {
  return request<Workflow>(`/api/projects/${projectId}/workflows`, {
    method: "POST",
    body: JSON.stringify(workflow),
  });
}

export async function deleteWorkflow(projectId: string, workflowId: string): Promise<void> {
  return request<void>(`/api/projects/${projectId}/workflows/${workflowId}`, {
    method: "DELETE",
  });
}

// Schema Evolution
export type SchemaOperationResponse = {
  success: boolean;
  operation: string;
  details: Record<string, unknown>;
};

export type PreviewMigrationResponse = {
  operation: string;
  collection: string;
  steps: string[];
  warnings: string[];
  params: Record<string, unknown>;
};

export type AliasInfo = {
  old_name: string;
  collection_id?: string;
  field_id?: string;
  expires_at?: string;
};

export type ActiveAliasesResponse = {
  collection_aliases: AliasInfo[];
  field_aliases: AliasInfo[];
};

export async function renameCollection(
  projectId: string,
  collectionId: string,
  newName: string,
  newDisplayName?: string,
): Promise<SchemaOperationResponse> {
  return request<SchemaOperationResponse>(
    `/api/projects/${projectId}/schema/evolution/collections/${collectionId}/rename`,
    {
      method: "POST",
      body: JSON.stringify({ new_name: newName, new_display_name: newDisplayName }),
    },
  );
}

export async function renameField(
  projectId: string,
  collectionId: string,
  fieldId: string,
  newName: string,
  newDisplayName?: string,
): Promise<SchemaOperationResponse> {
  return request<SchemaOperationResponse>(
    `/api/projects/${projectId}/schema/evolution/collections/${collectionId}/fields/${fieldId}/rename`,
    {
      method: "POST",
      body: JSON.stringify({ new_name: newName, new_display_name: newDisplayName }),
    },
  );
}

export async function softDeleteField(
  projectId: string,
  collectionId: string,
  fieldId: string,
): Promise<SchemaOperationResponse> {
  return request<SchemaOperationResponse>(
    `/api/projects/${projectId}/schema/evolution/collections/${collectionId}/fields/${fieldId}/soft-delete`,
    { method: "POST" },
  );
}

export async function hardDeleteField(
  projectId: string,
  collectionId: string,
  fieldId: string,
  force = false,
): Promise<SchemaOperationResponse> {
  return request<SchemaOperationResponse>(
    `/api/projects/${projectId}/schema/evolution/collections/${collectionId}/fields/${fieldId}/hard-delete?force=${force}`,
    { method: "POST" },
  );
}

export async function restoreField(
  projectId: string,
  collectionId: string,
  fieldId: string,
): Promise<SchemaOperationResponse> {
  return request<SchemaOperationResponse>(
    `/api/projects/${projectId}/schema/evolution/collections/${collectionId}/fields/${fieldId}/restore`,
    { method: "POST" },
  );
}

export async function changeFieldType(
  projectId: string,
  collectionId: string,
  fieldId: string,
  newType: string,
): Promise<SchemaOperationResponse> {
  return request<SchemaOperationResponse>(
    `/api/projects/${projectId}/schema/evolution/collections/${collectionId}/fields/${fieldId}/change-type`,
    {
      method: "POST",
      body: JSON.stringify({ new_type: newType }),
    },
  );
}

export async function previewMigration(
  projectId: string,
  collectionId: string,
  operation: string,
  params: Record<string, unknown>,
): Promise<PreviewMigrationResponse> {
  return request<PreviewMigrationResponse>(
    `/api/projects/${projectId}/schema/evolution/collections/${collectionId}/preview-migration`,
    {
      method: "POST",
      body: JSON.stringify({ operation, params }),
    },
  );
}

export async function fetchActiveAliases(projectId: string): Promise<ActiveAliasesResponse> {
  return request<ActiveAliasesResponse>(`/api/projects/${projectId}/schema/evolution/aliases`);
}

export async function fetchSafeConversions(projectId: string): Promise<{ safe_conversions: { from: string; to: string; description: string }[] }> {
  return request(`/api/projects/${projectId}/schema/evolution/safe-conversions`);
}

// Relations
export type RelationField = {
  id: string;
  name: string;
  display_name: string;
  field_type: string;
  sql_column_name: string;
  is_required: boolean;
  relation_target_collection_id: string | null;
  relation_type: string | null;
  relation_on_delete: string | null;
  relation_display_field: string | null;
  target_collection_name?: string;
  created_at: string;
  updated_at: string;
};

export type ReverseRelation = {
  id: string;
  name: string;
  display_name: string;
  source_collection_id: string;
  source_collection_name: string;
  relation_type: string;
  sql_column_name: string;
};

export async function createRelationField(
  projectId: string,
  collectionId: string,
  relation: {
    name: string;
    display_name: string;
    target_collection_id: string;
    relation_type?: string;
    on_delete?: string;
    display_field?: string;
    is_required?: boolean;
  },
): Promise<RelationField> {
  return request<RelationField>(
    `/api/projects/${projectId}/schema/relations/collections/${collectionId}/relations`,
    {
      method: "POST",
      body: JSON.stringify(relation),
    },
  );
}

export async function fetchRelationFields(projectId: string, collectionId: string): Promise<RelationField[]> {
  return request<RelationField[]>(
    `/api/projects/${projectId}/schema/relations/collections/${collectionId}/relations`,
  );
}

export async function fetchReverseRelations(projectId: string, collectionId: string): Promise<ReverseRelation[]> {
  return request<ReverseRelation[]>(
    `/api/projects/${projectId}/schema/relations/collections/${collectionId}/reverse-relations`,
  );
}

export async function fetchRelationOptions(projectId: string): Promise<{
  relation_types: { value: string; label: string; description: string }[];
  on_delete_actions: { value: string; label: string; description: string }[];
}> {
  return request(`/api/projects/${projectId}/schema/relations/relation-options`);
}

// Views
export type ViewFilter = {
  field: string;
  operator: string;
  value?: unknown;
  is_param?: boolean;
  param_name?: string;
};

export type ViewSort = {
  field: string;
  desc?: boolean;
  is_param?: boolean;
  param_name?: string;
  desc_is_param?: boolean;
  desc_param_name?: string;
};

export type View = {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  base_collection_id: string;
  projection: string[] | null;
  filters: ViewFilter[] | null;
  sorts: ViewSort[] | null;
  joins: unknown[] | null;
  params_schema: Record<string, unknown> | null;
  default_limit: number;
  max_limit: number;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ViewExecuteResult = {
  data: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
  view_name: string;
  view_version: number;
};

export type ViewParamDef = {
  type: string;
  required: boolean;
  description?: string;
};

export type ViewParamsSchema = Record<string, ViewParamDef>;

export async function createView(
  projectId: string,
  view: {
    name: string;
    display_name: string;
    base_collection_id: string;
    description?: string;
    projection?: string[];
    filters?: ViewFilter[];
    sorts?: ViewSort[];
    default_limit?: number;
    max_limit?: number;
    params_schema?: ViewParamsSchema;
  },
): Promise<View> {
  return request<View>(`/api/projects/${projectId}/views`, {
    method: "POST",
    body: JSON.stringify(view),
  });
}

export async function fetchViews(projectId: string): Promise<View[]> {
  return request<View[]>(`/api/projects/${projectId}/views`);
}

export async function fetchView(projectId: string, viewName: string): Promise<View> {
  return request<View>(`/api/projects/${projectId}/views/${viewName}`);
}

export async function updateView(
  projectId: string,
  viewName: string,
  updates: {
    display_name?: string;
    description?: string;
    projection?: string[];
    filters?: ViewFilter[];
    sorts?: ViewSort[];
  },
): Promise<View> {
  return request<View>(`/api/projects/${projectId}/views/${viewName}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteView(projectId: string, viewName: string): Promise<void> {
  return request<void>(`/api/projects/${projectId}/views/${viewName}`, {
    method: "DELETE",
  });
}

export async function executeView(
  projectId: string,
  viewName: string,
  options?: {
    params?: Record<string, unknown>;
    limit?: number;
    offset?: number;
  },
): Promise<ViewExecuteResult> {
  return request<ViewExecuteResult>(`/api/projects/${projectId}/views/${viewName}/execute`, {
    method: "POST",
    body: JSON.stringify(options || {}),
  });
}

export async function fetchViewOperators(projectId: string): Promise<{
  operators: { value: string; label: string; types: string[] }[];
}> {
  return request(`/api/projects/${projectId}/views/operators`);
}

export type ViewMeta = {
  view_name: string;
  display_name: string;
  description: string | null;
  base_collection: string | null;
  endpoint: {
    url: string;
    method: string;
    auth: string[];
  };
  request: {
    body: {
      limit: { type: string; default: number; max: number; description: string };
      offset: { type: string; default: number; description: string };
      params: { type: string; description: string; fields: { name: string; type: string; required: boolean; description: string; example: string }[] } | null;
    };
  };
  response: {
    fields: { name: string; type: string; display_name: string }[];
    pagination: { type: string; default_limit: number; max_limit: number };
  };
  filters: {
    allowed_fields: string[];
    operators: string[];
    predefined: { field: string; operator: string; value: unknown }[];
  };
  sorts: {
    allowed_fields: string[];
    default: { field: string; desc: boolean };
    predefined: { field: string; desc: boolean }[];
  };
  examples: {
    curl: string;
    fetch: string;
  };
};

export async function fetchViewMeta(projectId: string, viewName: string): Promise<ViewMeta> {
  return request<ViewMeta>(`/api/projects/${projectId}/views/${viewName}/meta`);
}

// Validations
export type ValidationRule = {
  id: string;
  field_id: string;
  rule_type: string;
  config: Record<string, unknown> | null;
  error_message: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function createValidationRule(
  projectId: string,
  collectionName: string,
  fieldName: string,
  rule: {
    rule_type: string;
    config?: Record<string, unknown>;
    error_message?: string;
    priority?: number;
  },
): Promise<ValidationRule> {
  return request<ValidationRule>(
    `/api/projects/${projectId}/validations/collections/${collectionName}/fields/${fieldName}/rules`,
    {
      method: "POST",
      body: JSON.stringify(rule),
    },
  );
}

export async function fetchValidationRules(
  projectId: string,
  collectionName: string,
  fieldName: string,
): Promise<ValidationRule[]> {
  return request<ValidationRule[]>(
    `/api/projects/${projectId}/validations/collections/${collectionName}/fields/${fieldName}/rules`,
  );
}

export async function updateValidationRule(
  projectId: string,
  ruleId: string,
  updates: {
    config?: Record<string, unknown>;
    error_message?: string;
    priority?: number;
    is_active?: boolean;
  },
): Promise<ValidationRule> {
  return request<ValidationRule>(`/api/projects/${projectId}/validations/rules/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteValidationRule(projectId: string, ruleId: string): Promise<void> {
  return request<void>(`/api/projects/${projectId}/validations/rules/${ruleId}`, {
    method: "DELETE",
  });
}

export async function validateRecord(
  projectId: string,
  collectionName: string,
  data: Record<string, unknown>,
): Promise<{ is_valid: boolean; errors: Record<string, string[]> }> {
  return request(`/api/projects/${projectId}/validations/collections/${collectionName}/validate`, {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export async function fetchValidationRuleTypes(projectId: string): Promise<{
  rule_types: { type: string; applies_to: string[]; config_schema: Record<string, string> }[];
}> {
  return request(`/api/projects/${projectId}/validations/rule-types`);
}

// Files
export type StoredFile = {
  id: string;
  filename: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  bucket: string | null;
  collection_id: string | null;
  record_id: string | null;
  field_name: string | null;
  is_public: boolean;
  uploaded_by_user_id: string | null;
  download_url?: string;
  created_at: string;
  updated_at: string;
};

export type StorageStats = {
  file_count: number;
  total_bytes: number;
  total_mb: number;
};

export async function uploadFile(
  projectId: string,
  file: File,
  bucket?: string,
  isPublic?: boolean,
): Promise<StoredFile> {
  const formData = new FormData();
  formData.append("file", file);
  if (bucket) formData.append("bucket", bucket);
  if (isPublic !== undefined) formData.append("is_public", String(isPublic));

  const tokensRaw = localStorage.getItem("backendify.tokens");
  const token = tokensRaw ? JSON.parse(tokensRaw).accessToken : null;
  const res = await fetch(`${API_URL}/api/projects/${projectId}/files/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || "Upload failed");
  }

  return res.json();
}

export async function fetchFiles(
  projectId: string,
  params?: { bucket?: string; limit?: number; offset?: number },
): Promise<StoredFile[]> {
  const query = new URLSearchParams();
  if (params?.bucket) query.set("bucket", params.bucket);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  const qs = query.toString();
  return request<StoredFile[]>(`/api/projects/${projectId}/files${qs ? `?${qs}` : ""}`);
}

export async function fetchFile(projectId: string, fileId: string): Promise<StoredFile> {
  return request<StoredFile>(`/api/projects/${projectId}/files/${fileId}`);
}

export async function deleteFile(projectId: string, fileId: string): Promise<void> {
  return request<void>(`/api/projects/${projectId}/files/${fileId}`, {
    method: "DELETE",
  });
}

export async function fetchStorageStats(projectId: string): Promise<StorageStats> {
  return request<StorageStats>(`/api/projects/${projectId}/files/stats`);
}

export function getFileDownloadUrl(projectId: string, fileId: string): string {
  return `${API_URL}/api/projects/${projectId}/files/${fileId}/download`;
}

// ============================================================================
// App User Auth Settings
// ============================================================================

export type AuthSettings = {
  id: string;
  project_id: string;
  enable_email_password: boolean;
  enable_magic_link: boolean;
  enable_otp: boolean;
  enable_oauth_google: boolean;
  enable_oauth_github: boolean;
  session_mode: "header" | "cookie";
  allow_public_signup: boolean;
  require_email_verification: boolean;
  access_ttl_minutes: number;
  refresh_ttl_days: number;
};

export type AuthSettingsUpdate = Partial<Omit<AuthSettings, "id" | "project_id">>;

export async function fetchAuthSettings(projectId: string): Promise<AuthSettings> {
  return request<AuthSettings>(`/api/projects/${projectId}/settings/auth`);
}

export async function updateAuthSettings(
  projectId: string,
  settings: AuthSettingsUpdate
): Promise<AuthSettings> {
  return request<AuthSettings>(`/api/projects/${projectId}/settings/auth`, {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

// ============================================================================
// App Users Management
// ============================================================================

export type AppUser = {
  id: string;
  email: string;
  is_email_verified: boolean;
  is_disabled: boolean;
  created_at: string;
};

export async function fetchAppUsers(
  projectId: string,
  params?: { limit?: number; offset?: number }
): Promise<AppUser[]> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  const qs = query.toString();
  return request<AppUser[]>(`/api/projects/${projectId}/settings/auth/users${qs ? `?${qs}` : ""}`);
}

export async function fetchAppUser(projectId: string, appUserId: string): Promise<AppUser> {
  return request<AppUser>(`/api/projects/${projectId}/settings/auth/users/${appUserId}`);
}

export async function updateAppUser(
  projectId: string,
  appUserId: string,
  data: { is_disabled?: boolean; is_email_verified?: boolean }
): Promise<AppUser> {
  return request<AppUser>(`/api/projects/${projectId}/settings/auth/users/${appUserId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteAppUser(projectId: string, appUserId: string): Promise<void> {
  return request<void>(`/api/projects/${projectId}/settings/auth/users/${appUserId}`, {
    method: "DELETE",
  });
}

export async function revokeAppUserSessions(projectId: string, appUserId: string): Promise<void> {
  return request<void>(`/api/projects/${projectId}/settings/auth/users/${appUserId}/revoke-sessions`, {
    method: "POST",
  });
}
