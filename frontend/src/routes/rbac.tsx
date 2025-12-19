import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Shield,
  Plus,
  Trash2,
  Edit2,
  Users,
  Star,
  Lock,
  Loader2,
  UserPlus,
  X,
  Search,
} from "lucide-react";
import {
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  initializeRbac,
  fetchAppUsers,
  fetchUserRoles,
  assignUserRoles,
  removeUserRole,
  Role,
  RoleCreate,
  RoleUpdate,
  AppUser,
  UserRoles,
} from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { PageHeader } from "../components/ui/page-header";
import { EmptyState } from "../components/ui/empty-state";
import { useToast } from "../components/Toast";

export const Route = createFileRoute("/projects/$projectId/rbac")({
  component: RbacPage,
});

type TabType = "roles" | "assignments";

export default function RbacPage() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabType>("roles");
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["roles", projectId],
    queryFn: () => fetchRoles(projectId),
  });

  const initMutation = useMutation({
    mutationFn: () => initializeRbac(projectId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["roles", projectId] });
      toast.success("Roles Initialized", `Created ${data.roles_created} default roles`);
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: (data: RoleCreate) => createRole(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", projectId] });
      setShowCreateRole(false);
      toast.success("Role created");
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ roleId, data }: { roleId: string; data: RoleUpdate }) =>
      updateRole(projectId, roleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", projectId] });
      setEditingRole(null);
      toast.success("Role updated");
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) => deleteRole(projectId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", projectId] });
      toast.success("Role deleted");
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Assignments"
        description="Manage roles and assign them to your app users."
        icon={<Shield className="h-6 w-6" />}
        actions={
          activeTab === "roles" ? (
            <div className="flex gap-2">
              <Button
                onClick={() => initMutation.mutate()}
                disabled={initMutation.isPending}
                variant="secondary"
              >
                {initMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Users className="h-4 w-4 mr-2" />
                )}
                Initialize Defaults
              </Button>
              <Button onClick={() => setShowCreateRole(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            </div>
          ) : null
        }
      />

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab("roles")}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === "roles"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <Shield className="h-4 w-4 inline mr-2" />
            Roles
          </button>
          <button
            onClick={() => setActiveTab("assignments")}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === "assignments"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <UserPlus className="h-4 w-4 inline mr-2" />
            User Assignments
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "roles" ? (
        <>
          {rolesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : roles.length === 0 ? (
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title="No roles yet"
              description="Create roles to control access in your policies. Roles like 'admin', 'editor', 'viewer' help organize user permissions."
              action={
                <Button onClick={() => initMutation.mutate()}>
                  Initialize Default Roles
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => (
                <Card key={role.id} className="relative">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                          <Shield className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{role.display_name}</CardTitle>
                          <p className="text-xs text-slate-500 font-mono">{role.name}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {role.is_system && (
                          <Badge tone="slate" className="text-xs">
                            <Lock className="h-3 w-3 mr-1" />
                            System
                          </Badge>
                        )}
                        {role.is_default && (
                          <Badge tone="emerald" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 mb-4">
                      {role.description || "No description"}
                    </p>
                    <div className="flex gap-2">
                      {!role.is_system && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingRole(role)}
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              if (confirm("Delete this role?")) {
                                deleteRoleMutation.mutate(role.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <UserAssignmentsTab
          projectId={projectId}
          roles={roles}
          selectedUser={selectedUser}
          onSelectUser={setSelectedUser}
        />
      )}

      {/* Create Role Modal */}
      {showCreateRole && (
        <CreateRoleModal
          onClose={() => setShowCreateRole(false)}
          onSubmit={(data) => createRoleMutation.mutate(data)}
          isLoading={createRoleMutation.isPending}
        />
      )}

      {/* Edit Role Modal */}
      {editingRole && (
        <EditRoleModal
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onSubmit={(data) =>
            updateRoleMutation.mutate({ roleId: editingRole.id, data })
          }
          isLoading={updateRoleMutation.isPending}
        />
      )}
    </div>
  );
}

// Create Role Modal
function CreateRoleModal({
  onClose,
  onSubmit,
  isLoading,
}: {
  onClose: () => void;
  onSubmit: (data: RoleCreate) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.toLowerCase().replace(/\s+/g, "_"),
      display_name: displayName,
      description: description || undefined,
      is_default: isDefault,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Create Role</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Display Name
            </label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Content Editor"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Identifier
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., content_editor"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Used in code and policies
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-slate-300"
            />
            <label htmlFor="isDefault" className="text-sm text-slate-700">
              Set as default role for new users
            </label>
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Role Modal
function EditRoleModal({
  role,
  onClose,
  onSubmit,
  isLoading,
}: {
  role: Role;
  onClose: () => void;
  onSubmit: (data: RoleUpdate) => void;
  isLoading: boolean;
}) {
  const [displayName, setDisplayName] = useState(role.display_name);
  const [description, setDescription] = useState(role.description || "");
  const [isDefault, setIsDefault] = useState(role.is_default);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      display_name: displayName,
      description: description || undefined,
      is_default: isDefault,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Edit Role</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Display Name
            </label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="editIsDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-slate-300"
            />
            <label htmlFor="editIsDefault" className="text-sm text-slate-700">
              Set as default role for new users
            </label>
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// User Assignments Tab
function UserAssignmentsTab({
  projectId,
  roles,
  selectedUser,
  onSelectUser,
}: {
  projectId: string;
  roles: Role[];
  selectedUser: AppUser | null;
  onSelectUser: (user: AppUser | null) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: appUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["appUsers", projectId],
    queryFn: () => fetchAppUsers(projectId, { limit: 100 }),
  });

  const { data: userRoles, isLoading: userRolesLoading } = useQuery({
    queryKey: ["userRoles", projectId, selectedUser?.id],
    queryFn: () => fetchUserRoles(projectId, selectedUser!.id),
    enabled: !!selectedUser,
  });

  const assignRolesMutation = useMutation({
    mutationFn: (roleIds: string[]) =>
      assignUserRoles(projectId, selectedUser!.id, roleIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userRoles", projectId, selectedUser?.id] });
      toast.success("Roles updated");
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: (roleId: string) =>
      removeUserRole(projectId, selectedUser!.id, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userRoles", projectId, selectedUser?.id] });
      toast.success("Role removed");
    },
  });

  const filteredUsers = appUsers.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentRoleIds = userRoles?.roles.map((r) => r.id) || [];

  const handleToggleRole = (roleId: string) => {
    if (currentRoleIds.includes(roleId)) {
      removeRoleMutation.mutate(roleId);
    } else {
      assignRolesMutation.mutate([roleId]);
    }
  };

  if (roles.length === 0) {
    return (
      <EmptyState
        icon={<Shield className="h-12 w-12" />}
        title="No roles available"
        description="Create roles first before assigning them to users."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* User List */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">App Users</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {usersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                {appUsers.length === 0 ? "No app users yet" : "No users match your search"}
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => onSelectUser(user)}
                    className={`w-full px-4 py-3 text-left border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${
                      selectedUser?.id === user.id ? "bg-indigo-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-600 text-sm font-medium">
                        {user.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {user.email}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {user.id.slice(0, 8)}...
                        </p>
                      </div>
                      {user.is_disabled && (
                        <Badge tone="rose" className="text-xs">Disabled</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Role Assignment Panel */}
      <div className="lg:col-span-2">
        {selectedUser ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Assign Roles</CardTitle>
                  <p className="text-sm text-slate-500 mt-1">{selectedUser.email}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onSelectUser(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {userRolesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                </div>
              ) : (
                <div className="space-y-3">
                  {roles.map((role) => {
                    const isAssigned = currentRoleIds.includes(role.id);
                    const isLoading =
                      assignRolesMutation.isPending || removeRoleMutation.isPending;

                    return (
                      <div
                        key={role.id}
                        className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                          isAssigned
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                              isAssigned ? "bg-indigo-100" : "bg-slate-100"
                            }`}
                          >
                            <Shield
                              className={`h-5 w-5 ${
                                isAssigned ? "text-indigo-600" : "text-slate-400"
                              }`}
                            />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {role.display_name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {role.description || role.name}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isAssigned ? "danger" : "primary"}
                          onClick={() => handleToggleRole(role.id)}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isAssigned ? (
                            <>
                              <X className="h-3 w-3 mr-1" />
                              Remove
                            </>
                          ) : (
                            <>
                              <Plus className="h-3 w-3 mr-1" />
                              Assign
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="h-full flex items-center justify-center min-h-[300px]">
            <div className="text-center p-8">
              <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Select a user to manage their roles</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
