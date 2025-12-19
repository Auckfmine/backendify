import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import {
  Users,
  Plus,
  Search,
  Shield,
  Mail,
  MailCheck,
  Ban,
  CheckCircle,
  Loader2,
  MoreVertical,
  Trash2,
  Key,
  X,
  Edit2,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  fetchAppUsers,
  fetchUserRoles,
  assignUserRoles,
  removeUserRole,
  createAppUser,
  updateAppUser,
  deleteAppUser,
  revokeAppUserSessions,
  fetchRoles,
  AppUser,
  AppUserCreate,
  AppUserUpdate,
  Role,
} from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { PageHeader } from "../components/ui/page-header";
import { EmptyState } from "../components/ui/empty-state";
import { useToast } from "../components/Toast";

export default function UsersPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form state for create/edit
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    is_email_verified: false,
    is_disabled: false,
  });

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      is_email_verified: false,
      is_disabled: false,
    });
    setShowPassword(false);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = () => {
    if (selectedUser) {
      setFormData({
        email: selectedUser.email,
        password: "",
        is_email_verified: selectedUser.is_email_verified,
        is_disabled: selectedUser.is_disabled,
      });
      setShowEditModal(true);
    }
  };

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["appUsers", projectId],
    queryFn: () => fetchAppUsers(projectId, { limit: 100 }),
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles", projectId],
    queryFn: () => fetchRoles(projectId),
  });

  const { data: userRoles, isLoading: userRolesLoading } = useQuery({
    queryKey: ["userRoles", projectId, selectedUser?.id],
    queryFn: () => fetchUserRoles(projectId, selectedUser!.id),
    enabled: !!selectedUser,
  });

  const createUserMutation = useMutation({
    mutationFn: (data: AppUserCreate) => createAppUser(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appUsers", projectId] });
      setShowCreateModal(false);
      resetForm();
      toast.success("User created");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create user");
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: AppUserUpdate }) =>
      updateAppUser(projectId, userId, data),
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ["appUsers", projectId] });
      setSelectedUser(updatedUser);
      setShowEditModal(false);
      resetForm();
      toast.success("User updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update user");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => deleteAppUser(projectId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appUsers", projectId] });
      setSelectedUser(null);
      toast.success("User deleted");
    },
  });

  const revokeSessionsMutation = useMutation({
    mutationFn: (userId: string) => revokeAppUserSessions(projectId, userId),
    onSuccess: () => {
      toast.success("All sessions revoked");
    },
  });

  const assignRolesMutation = useMutation({
    mutationFn: (roleIds: string[]) =>
      assignUserRoles(projectId, selectedUser!.id, roleIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userRoles", projectId, selectedUser?.id] });
      toast.success("Role assigned");
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

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentRoleIds = userRoles?.roles.map((r) => r.id) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="App Users"
        description="Manage your application's end users, their roles, and access."
        icon={<Users className="h-6 w-6" />}
        actions={
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Create User
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Users ({users.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-3 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by email or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              {usersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-6 text-center">
                  {users.length === 0 ? (
                    <EmptyState
                      icon={<Users className="h-10 w-10" />}
                      title="No users yet"
                      description="Users will appear here when they sign up for your app."
                    />
                  ) : (
                    <p className="text-sm text-slate-500">No users match your search</p>
                  )}
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`w-full px-4 py-3 text-left border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${
                        selectedUser?.id === user.id ? "bg-indigo-50 border-l-2 border-l-indigo-500" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-sm font-medium">
                          {user.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {user.email}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {user.is_email_verified ? (
                              <span className="flex items-center text-xs text-emerald-600">
                                <MailCheck className="h-3 w-3 mr-0.5" />
                                Verified
                              </span>
                            ) : (
                              <span className="flex items-center text-xs text-amber-600">
                                <Mail className="h-3 w-3 mr-0.5" />
                                Unverified
                              </span>
                            )}
                            {user.is_disabled && (
                              <Badge tone="rose" className="text-xs py-0">
                                <Ban className="h-3 w-3 mr-0.5" />
                                Disabled
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* User Details Panel */}
        <div className="lg:col-span-2">
          {selectedUser ? (
            <div className="space-y-4">
              {/* User Info Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-xl font-medium">
                        {selectedUser.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{selectedUser.email}</CardTitle>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          ID: {selectedUser.id}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedUser(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">Email Status</p>
                      <div className="flex items-center gap-2">
                        {selectedUser.is_email_verified ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            <span className="text-sm font-medium text-emerald-700">Verified</span>
                          </>
                        ) : (
                          <>
                            <Mail className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-medium text-amber-700">Unverified</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">Account Status</p>
                      <div className="flex items-center gap-2">
                        {selectedUser.is_disabled ? (
                          <>
                            <Ban className="h-4 w-4 text-rose-500" />
                            <span className="text-sm font-medium text-rose-700">Disabled</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            <span className="text-sm font-medium text-emerald-700">Active</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        updateUserMutation.mutate({
                          userId: selectedUser.id,
                          data: { is_email_verified: !selectedUser.is_email_verified },
                        })
                      }
                      disabled={updateUserMutation.isPending}
                    >
                      {selectedUser.is_email_verified ? (
                        <>
                          <Mail className="h-4 w-4 mr-1" />
                          Mark Unverified
                        </>
                      ) : (
                        <>
                          <MailCheck className="h-4 w-4 mr-1" />
                          Mark Verified
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedUser.is_disabled ? "primary" : "secondary"}
                      onClick={() =>
                        updateUserMutation.mutate({
                          userId: selectedUser.id,
                          data: { is_disabled: !selectedUser.is_disabled },
                        })
                      }
                      disabled={updateUserMutation.isPending}
                    >
                      {selectedUser.is_disabled ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Enable Account
                        </>
                      ) : (
                        <>
                          <Ban className="h-4 w-4 mr-1" />
                          Disable Account
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => revokeSessionsMutation.mutate(selectedUser.id)}
                      disabled={revokeSessionsMutation.isPending}
                    >
                      <Key className="h-4 w-4 mr-1" />
                      Revoke Sessions
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={openEditModal}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit User
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (confirm(`Delete user ${selectedUser.email}? This cannot be undone.`)) {
                          deleteUserMutation.mutate(selectedUser.id);
                        }
                      }}
                      disabled={deleteUserMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete User
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Roles Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Assigned Roles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userRolesLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                    </div>
                  ) : roles.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">
                      No roles defined. Create roles in the RBAC settings.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {roles.map((role) => {
                        const isAssigned = currentRoleIds.includes(role.id);
                        const isLoading = assignRolesMutation.isPending || removeRoleMutation.isPending;

                        return (
                          <div
                            key={role.id}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                              isAssigned
                                ? "border-indigo-200 bg-indigo-50"
                                : "border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Shield
                                className={`h-4 w-4 ${
                                  isAssigned ? "text-indigo-600" : "text-slate-400"
                                }`}
                              />
                              <div>
                                <p className={`text-sm font-medium ${isAssigned ? "text-indigo-900" : "text-slate-700"}`}>
                                  {role.display_name}
                                </p>
                                <p className="text-xs text-slate-500">{role.name}</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant={isAssigned ? "danger" : "secondary"}
                              onClick={() => {
                                if (isAssigned) {
                                  removeRoleMutation.mutate(role.id);
                                } else {
                                  assignRolesMutation.mutate([role.id]);
                                }
                              }}
                              disabled={isLoading}
                            >
                              {isLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : isAssigned ? (
                                "Remove"
                              ) : (
                                "Assign"
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <div className="text-center p-8">
                <Users className="h-16 w-16 text-slate-200 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">Select a User</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Choose a user from the list to view their details, manage roles, and perform actions.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Create User</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createUserMutation.mutate({
                  email: formData.email,
                  password: formData.password || undefined,
                  is_email_verified: formData.is_email_verified,
                  is_disabled: formData.is_disabled,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email *
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Leave empty for passwordless"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Min 8 characters. Leave empty if using passwordless auth.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_email_verified}
                    onChange={(e) => setFormData({ ...formData, is_email_verified: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700">Email verified</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_disabled}
                    onChange={(e) => setFormData({ ...formData, is_disabled: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700">Disabled</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createUserMutation.isPending || !formData.email}
                >
                  {createUserMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create User"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowEditModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Edit User</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const updateData: AppUserUpdate = {};
                if (formData.email !== selectedUser.email) {
                  updateData.email = formData.email;
                }
                if (formData.password) {
                  updateData.password = formData.password;
                }
                if (formData.is_email_verified !== selectedUser.is_email_verified) {
                  updateData.is_email_verified = formData.is_email_verified;
                }
                if (formData.is_disabled !== selectedUser.is_disabled) {
                  updateData.is_disabled = formData.is_disabled;
                }
                updateUserMutation.mutate({
                  userId: selectedUser.id,
                  data: updateData,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Leave empty to keep current"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Leave empty to keep current password.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_email_verified}
                    onChange={(e) => setFormData({ ...formData, is_email_verified: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700">Email verified</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_disabled}
                    onChange={(e) => setFormData({ ...formData, is_disabled: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700">Disabled</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                >
                  {updateUserMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
