import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { FileBox, Upload, Download, Trash2, HardDrive, FolderOpen } from "lucide-react";
import {
  deleteFile,
  fetchFiles,
  fetchStorageStats,
  getFileDownloadUrl,
  uploadFile,
  type StoredFile,
} from "../lib/api";
import { Button, Card, Input, PageHeader, Badge, FormField, StatCard, EmptyState } from "../components/ui";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function FilesPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bucket, setBucket] = useState("");
  const [filterBucket, setFilterBucket] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filesQuery = useQuery({
    queryKey: ["files", projectId, filterBucket],
    queryFn: () => fetchFiles(projectId, { bucket: filterBucket || undefined }),
  });

  const statsQuery = useQuery({
    queryKey: ["storage-stats", projectId],
    queryFn: () => fetchStorageStats(projectId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadFile(projectId, file, bucket || undefined, isPublic),
    onSuccess: () => {
      setSuccess("File uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["files", projectId] });
      queryClient.invalidateQueries({ queryKey: ["storage-stats", projectId] });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => deleteFile(projectId, fileId),
    onSuccess: () => {
      setSuccess("File deleted");
      queryClient.invalidateQueries({ queryKey: ["files", projectId] });
      queryClient.invalidateQueries({ queryKey: ["storage-stats", projectId] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError(null);
      setSuccess(null);
      uploadMutation.mutate(file);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Storage"
        title="File Storage"
        description="Upload and manage files for your project"
        icon={<FileBox className="h-6 w-6" />}
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
        {/* Upload Panel */}
        <Card padding="md">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-900">Upload File</h2>
          </div>
          <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <FormField label="Bucket" hint="Optional">
              <Input
                value={bucket}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBucket(e.target.value)}
                placeholder="e.g., images, documents"
              />
            </FormField>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="isPublic" className="text-sm text-slate-700">Make file public</label>
            </div>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-indigo-300 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="w-full text-sm text-slate-600"
                disabled={uploadMutation.isPending}
              />
            </div>
            {uploadMutation.isPending && (
              <p className="text-sm text-indigo-600 font-medium">Uploading...</p>
            )}
          </div>
        </Card>

        {/* Stats Panel */}
        <Card padding="md">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-900">Storage Stats</h2>
          </div>
          {statsQuery.data ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600">Files</span>
                <Badge tone="indigo">{statsQuery.data.file_count}</Badge>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600">Total Size</span>
                <Badge tone="emerald">{formatBytes(statsQuery.data.total_bytes)}</Badge>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
            </div>
          )}
        </Card>

        {/* Filter Panel */}
        <Card padding="md">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-900">Filter</h2>
          </div>
          <FormField label="By Bucket">
            <Input
              value={filterBucket}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterBucket(e.target.value)}
              placeholder="Filter by bucket name"
            />
          </FormField>
        </Card>
      </div>

      {/* Files Table */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Files</h2>
          <Badge tone="indigo">{filesQuery.data?.length || 0} files</Badge>
        </div>
        
        {filesQuery.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : filesQuery.data?.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-xs">Filename</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-xs">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-xs">Size</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-xs">Bucket</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-xs">Public</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-xs">Uploaded</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-xs">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filesQuery.data?.map((file: StoredFile) => (
                  <tr key={file.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{file.original_filename}</div>
                      <div className="text-xs text-slate-400 font-mono">{file.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{file.content_type}</td>
                    <td className="px-4 py-3 text-slate-900">{formatBytes(file.size_bytes)}</td>
                    <td className="px-4 py-3">
                      {file.bucket ? (
                        <Badge tone="indigo">{file.bucket}</Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {file.is_public ? (
                        <Badge tone="emerald">Public</Badge>
                      ) : (
                        <Badge tone="slate">Private</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(file.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <a
                          href={getFileDownloadUrl(projectId, file.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                        <button
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          onClick={() => deleteMutation.mutate(file.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<FileBox className="h-6 w-6" />}
            title="No files yet"
            description="Upload your first file to get started"
          />
        )}
      </Card>
    </div>
  );
}
