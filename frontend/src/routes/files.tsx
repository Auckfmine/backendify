import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  deleteFile,
  fetchFiles,
  fetchStorageStats,
  getFileDownloadUrl,
  uploadFile,
  type StoredFile,
} from "../lib/api";

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
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">File Storage</h1>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Upload File</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Bucket (optional)</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={bucket}
                onChange={(e) => setBucket(e.target.value)}
                placeholder="e.g., images, documents"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <label htmlFor="isPublic" className="text-sm">Make file public</label>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="w-full text-sm"
                disabled={uploadMutation.isPending}
              />
            </div>
            {uploadMutation.isPending && (
              <p className="text-sm text-blue-600">Uploading...</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Storage Stats</h2>
          {statsQuery.data ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Files:</span>
                <span className="font-medium">{statsQuery.data.file_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Size:</span>
                <span className="font-medium">{formatBytes(statsQuery.data.total_bytes)}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Loading...</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Filter</h2>
          <div>
            <label className="block text-sm font-medium mb-1">By Bucket</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={filterBucket}
              onChange={(e) => setFilterBucket(e.target.value)}
              placeholder="Filter by bucket name"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Files ({filesQuery.data?.length || 0})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-medium">Filename</th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Size</th>
                <th className="text-left p-3 font-medium">Bucket</th>
                <th className="text-left p-3 font-medium">Public</th>
                <th className="text-left p-3 font-medium">Uploaded</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filesQuery.data?.map((file: StoredFile) => (
                <tr key={file.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">
                    <div className="font-medium">{file.original_filename}</div>
                    <div className="text-xs text-gray-400">{file.id.slice(0, 8)}...</div>
                  </td>
                  <td className="p-3 text-gray-600">{file.content_type}</td>
                  <td className="p-3">{formatBytes(file.size_bytes)}</td>
                  <td className="p-3">
                    {file.bucket ? (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                        {file.bucket}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="p-3">
                    {file.is_public ? (
                      <span className="text-green-600">Yes</span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </td>
                  <td className="p-3 text-gray-600">
                    {new Date(file.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <a
                        href={getFileDownloadUrl(projectId, file.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Download
                      </a>
                      <button
                        className="text-red-600 hover:underline text-sm"
                        onClick={() => deleteMutation.mutate(file.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filesQuery.data?.length === 0 && (
            <p className="text-gray-500 text-center py-8">No files uploaded yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
