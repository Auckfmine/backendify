import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  AuditEvent,
  AuditEventFilters,
  Collection,
  SchemaOp,
  fetchAuditEvents,
  fetchCollections,
  fetchSchemaOps,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { Card, SectionTitle } from "../components/ui";

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "auth.login", label: "Auth Login" },
  { value: "auth.register", label: "Auth Register" },
  { value: "auth.refresh", label: "Auth Refresh" },
  { value: "auth.logout", label: "Auth Logout" },
];

const ACTOR_TYPE_OPTIONS = [
  { value: "", label: "All Actors" },
  { value: "admin_user", label: "Admin Users" },
  { value: "app_user", label: "App Users" },
  { value: "api_key", label: "API Keys" },
];

const TIME_RANGE_OPTIONS = [
  { value: "", label: "All Time" },
  { value: "1h", label: "Last Hour" },
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "custom", label: "Custom Range" },
];

function getChangedFields(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null): Set<string> {
  const changed = new Set<string>();
  if (!oldData || !newData) return changed;
  
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  for (const key of allKeys) {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changed.add(key);
    }
  }
  return changed;
}

function DataChangeView({ oldData, newData, action }: { 
  oldData: string | null; 
  newData: string | null; 
  action: string;
}) {
  const oldObj = oldData ? JSON.parse(oldData) : null;
  const newObj = newData ? JSON.parse(newData) : null;
  const changedFields = getChangedFields(oldObj, newObj);
  
  if (action === "create" && newObj) {
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-green-700 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          Record Created
        </h4>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(newObj).map(([key, value]) => (
                <tr key={key} className="border-b border-green-100 last:border-0">
                  <td className="py-1.5 pr-4 font-medium text-green-800 w-1/3">{key}</td>
                  <td className="py-1.5 font-mono text-green-700">
                    {typeof value === "object" ? JSON.stringify(value) : String(value ?? "null")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  
  if (action === "delete" && oldObj) {
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-red-700 flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
          Record Deleted
        </h4>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(oldObj).map(([key, value]) => (
                <tr key={key} className="border-b border-red-100 last:border-0">
                  <td className="py-1.5 pr-4 font-medium text-red-800 w-1/3">{key}</td>
                  <td className="py-1.5 font-mono text-red-700 line-through">
                    {typeof value === "object" ? JSON.stringify(value) : String(value ?? "null")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  
  if (action === "update" && oldObj && newObj) {
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-blue-700 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          Record Updated
          <span className="text-xs font-normal text-gray-500">
            ({changedFields.size} field{changedFields.size !== 1 ? "s" : ""} changed)
          </span>
        </h4>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase w-1/4">Field</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase w-3/8">Before</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase w-3/8">After</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(newObj).map((key) => {
                const isChanged = changedFields.has(key);
                const oldValue = oldObj[key];
                const newValue = newObj[key];
                return (
                  <tr 
                    key={key} 
                    className={`border-b border-gray-100 last:border-0 ${isChanged ? "bg-yellow-50" : ""}`}
                  >
                    <td className={`py-2 px-3 font-medium ${isChanged ? "text-yellow-800" : "text-gray-600"}`}>
                      {isChanged && <span className="mr-1">●</span>}
                      {key}
                    </td>
                    <td className={`py-2 px-3 font-mono text-xs ${isChanged ? "text-red-600 bg-red-50" : "text-gray-500"}`}>
                      {typeof oldValue === "object" ? JSON.stringify(oldValue) : String(oldValue ?? "null")}
                    </td>
                    <td className={`py-2 px-3 font-mono text-xs ${isChanged ? "text-green-600 bg-green-50" : "text-gray-500"}`}>
                      {typeof newValue === "object" ? JSON.stringify(newValue) : String(newValue ?? "null")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  
  // Auth events or other events with just new_data
  if (newObj) {
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-purple-700 flex items-center gap-2">
          <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
          Event Details
        </h4>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(newObj).map(([key, value]) => (
                <tr key={key} className="border-b border-purple-100 last:border-0">
                  <td className="py-1.5 pr-4 font-medium text-purple-800 w-1/3">{key}</td>
                  <td className="py-1.5 font-mono text-purple-700">
                    {typeof value === "object" ? JSON.stringify(value) : String(value ?? "null")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  
  return <p className="text-gray-500 text-sm">No data changes recorded</p>;
}

function getTimeRangeDates(range: string): { start_date?: string; end_date?: string } {
  if (!range || range === "custom") return {};
  
  const now = new Date();
  let startDate: Date;
  
  switch (range) {
    case "1h":
      startDate = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case "24h":
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      return {};
  }
  
  return { start_date: startDate.toISOString() };
}

export default function LogsPage() {
  const params = useRouterState({ select: (s) => s.matches.at(-1)?.params }) as { projectId: string } | undefined;
  const projectId = params?.projectId ?? "";

  const [activeTab, setActiveTab] = useState<"audit" | "schema">("audit");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<AuditEventFilters>({ limit: 100 });
  const [searchInput, setSearchInput] = useState("");
  const [timeRange, setTimeRange] = useState("");
  const [timeRangeTimestamp, setTimeRangeTimestamp] = useState<number | null>(null);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(0);

  // Compute time range dates from stored timestamp (stable across renders)
  const timeRangeDates = useMemo(() => {
    if (!timeRange || timeRange === "custom" || !timeRangeTimestamp) return {};
    
    let offset: number;
    switch (timeRange) {
      case "1h": offset = 60 * 60 * 1000; break;
      case "24h": offset = 24 * 60 * 60 * 1000; break;
      case "7d": offset = 7 * 24 * 60 * 60 * 1000; break;
      case "30d": offset = 30 * 24 * 60 * 60 * 1000; break;
      default: return {};
    }
    
    const startDate = new Date(timeRangeTimestamp - offset);
    return { start_date: startDate.toISOString() };
  }, [timeRange, timeRangeTimestamp]);

  // Build query filters
  const queryFilters: AuditEventFilters = useMemo(() => ({
    ...filters,
    ...timeRangeDates,
    ...(timeRange === "custom" && customStartDate ? { start_date: new Date(customStartDate).toISOString() } : {}),
    ...(timeRange === "custom" && customEndDate ? { end_date: new Date(customEndDate).toISOString() } : {}),
    offset: currentPage * (filters.limit || 100),
  }), [filters, timeRangeDates, timeRange, customStartDate, customEndDate, currentPage]);

  const auditQuery = useQuery({
    queryKey: [...queryKeys.auditEvents(projectId), queryFilters],
    queryFn: () => fetchAuditEvents(projectId, queryFilters),
  });

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, search: searchInput || undefined }));
    setCurrentPage(0);
  };

  const handleFilterChange = (key: keyof AuditEventFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value || undefined }));
    setCurrentPage(0);
  };

  const clearFilters = () => {
    setFilters({ limit: 100 });
    setSearchInput("");
    setTimeRange("");
    setTimeRangeTimestamp(null);
    setCustomStartDate("");
    setCustomEndDate("");
    setCurrentPage(0);
  };

  const totalPages = auditQuery.data ? Math.ceil(auditQuery.data.total / (filters.limit || 100)) : 0;

  const collectionsQuery = useQuery({
    queryKey: queryKeys.collections(projectId),
    queryFn: () => fetchCollections(projectId),
  });

  const schemaOpsQuery = useQuery({
    queryKey: queryKeys.schemaOps(projectId),
    queryFn: () => fetchSchemaOps(projectId, { limit: 100 }),
  });

  return (
    <div className="space-y-6">
      <SectionTitle>Logs</SectionTitle>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === "audit"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("audit")}
        >
          Audit Events
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === "schema"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("schema")}
        >
          Schema Operations
        </button>
      </div>

      {/* Audit Events Tab */}
      {activeTab === "audit" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Data Audit Events</h3>
            {auditQuery.data && (
              <span className="text-sm text-gray-500">
                {auditQuery.data.total} total events
              </span>
            )}
          </div>

          {/* Filters */}
          <div className="mb-6 space-y-4">
            {/* Search bar */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search in records, data, IP..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                Search
              </button>
              <button
                onClick={clearFilters}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Clear
              </button>
            </div>

            {/* Filter dropdowns */}
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 uppercase">Collection</label>
                <select
                  value={filters.collection_id || ""}
                  onChange={(e) => handleFilterChange("collection_id", e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Collections</option>
                  {collectionsQuery.data?.map((col: Collection) => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 uppercase">Action</label>
                <select
                  value={filters.action || ""}
                  onChange={(e) => handleFilterChange("action", e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ACTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 uppercase">Actor Type</label>
                <select
                  value={filters.actor_type || ""}
                  onChange={(e) => handleFilterChange("actor_type", e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ACTOR_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 uppercase">Time Range</label>
                <select
                  value={timeRange}
                  onChange={(e) => { 
                    const val = e.target.value;
                    setTimeRange(val); 
                    setTimeRangeTimestamp(val && val !== "custom" ? Date.now() : null);
                    setCurrentPage(0); 
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TIME_RANGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 uppercase">Record ID</label>
                <input
                  type="text"
                  placeholder="Filter by record ID"
                  value={filters.record_id || ""}
                  onChange={(e) => handleFilterChange("record_id", e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                />
              </div>
            </div>

            {/* Custom date range */}
            {timeRange === "custom" && (
              <div className="flex gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 uppercase">Start Date</label>
                  <input
                    type="datetime-local"
                    value={customStartDate}
                    onChange={(e) => { setCustomStartDate(e.target.value); setCurrentPage(0); }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 uppercase">End Date</label>
                  <input
                    type="datetime-local"
                    value={customEndDate}
                    onChange={(e) => { setCustomEndDate(e.target.value); setCurrentPage(0); }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {auditQuery.isLoading && <p className="text-gray-500">Loading...</p>}
          {auditQuery.error && <p className="text-red-500">Error loading audit events</p>}
          
          {auditQuery.data?.events.length === 0 && (
            <p className="text-gray-500">No audit events found matching your filters</p>
          )}

          {auditQuery.data && auditQuery.data.events.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Record ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {auditQuery.data.events.map((event: AuditEvent) => (
                    <>
                      <tr 
                        key={event.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                      >
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(event.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            event.action === "create" ? "bg-green-100 text-green-800" :
                            event.action === "update" ? "bg-blue-100 text-blue-800" :
                            event.action === "delete" ? "bg-red-100 text-red-800" :
                            event.action.startsWith("auth.") ? "bg-purple-100 text-purple-800" :
                            "bg-gray-100 text-gray-800"
                          }`}>
                            {event.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                          {event.record_id ? `${event.record_id.slice(0, 8)}...` : "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {event.actor_user_id ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">Admin</span>
                              <span className="font-mono">{event.actor_user_id.slice(0, 8)}...</span>
                            </span>
                          ) : event.actor_app_user_id ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">App User</span>
                              <span className="font-mono">{event.actor_app_user_id.slice(0, 8)}...</span>
                            </span>
                          ) : event.actor_api_key_id ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">API Key</span>
                              <span className="font-mono">{event.actor_api_key_id.slice(0, 8)}...</span>
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          <span className="flex items-center gap-2">
                            {event.ip_address || "-"}
                            <span className="text-gray-400">{expandedEvent === event.id ? "▼" : "▶"}</span>
                          </span>
                        </td>
                      </tr>
                      {expandedEvent === event.id && (
                        <tr key={`${event.id}-details`}>
                          <td colSpan={5} className="px-4 py-4 bg-gray-50 border-t border-b">
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4 p-3 bg-white rounded-lg border">
                                <div>
                                  <span className="block text-xs text-gray-500 uppercase">Event ID</span>
                                  <span className="font-mono text-gray-700 text-xs">{event.id.slice(0, 8)}...</span>
                                </div>
                                <div>
                                  <span className="block text-xs text-gray-500 uppercase">Collection ID</span>
                                  <span className="font-mono text-gray-700 text-xs">{event.collection_id ? `${event.collection_id.slice(0, 8)}...` : "-"}</span>
                                </div>
                                <div>
                                  <span className="block text-xs text-gray-500 uppercase">Record ID</span>
                                  <span className="font-mono text-gray-700 text-xs">{event.record_id ? `${event.record_id.slice(0, 8)}...` : "-"}</span>
                                </div>
                                <div>
                                  <span className="block text-xs text-gray-500 uppercase">User Agent</span>
                                  <span className="text-gray-700 text-xs truncate block max-w-[200px]">{event.user_agent || "-"}</span>
                                </div>
                              </div>
                              
                              <DataChangeView 
                                oldData={event.old_data_json} 
                                newData={event.new_data_json} 
                                action={event.action} 
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {auditQuery.data && totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-gray-500">
                Showing {currentPage * (filters.limit || 100) + 1} - {Math.min((currentPage + 1) * (filters.limit || 100), auditQuery.data.total)} of {auditQuery.data.total}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(0)}
                  disabled={currentPage === 0}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages - 1)}
                  disabled={currentPage >= totalPages - 1}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Schema Operations Tab */}
      {activeTab === "schema" && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Schema Change Log</h3>
          {schemaOpsQuery.isLoading && <p className="text-gray-500">Loading...</p>}
          {schemaOpsQuery.error && <p className="text-red-500">Error loading schema operations</p>}
          
          {schemaOpsQuery.data?.length === 0 && (
            <p className="text-gray-500">No schema operations yet</p>
          )}

          {schemaOpsQuery.data && schemaOpsQuery.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Operation</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {schemaOpsQuery.data.map((op: SchemaOp) => (
                    <tr key={op.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(op.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          op.op_type === "create_schema" ? "bg-purple-100 text-purple-800" :
                          op.op_type === "create_table" ? "bg-green-100 text-green-800" :
                          op.op_type === "add_column" ? "bg-blue-100 text-blue-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {op.op_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          op.status === "applied" ? "bg-green-100 text-green-800" :
                          op.status === "failed" ? "bg-red-100 text-red-800" :
                          "bg-yellow-100 text-yellow-800"
                        }`}>
                          {op.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                        {op.payload_json}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
