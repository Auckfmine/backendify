import { useState } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  Home,
  FolderKanban,
  LayoutDashboard,
  Database,
  Table2,
  ScrollText,
  Webhook,
  GitBranch,
  Shield,
  RefreshCw,
  Link2,
  Eye,
  CheckSquare,
  FileBox,
  KeyRound,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  PanelLeftClose,
  PanelLeft,
  Settings,
  Bell,
  Search,
  User,
  Users,
} from "lucide-react";
import { logout, fetchMe, fetchProject } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "./ui/button";
import { Avatar } from "./ui/avatar";

type NavItem = {
  label: string;
  to: string;
  params?: Record<string, string>;
  icon: React.ReactNode;
  match: (path: string) => boolean;
};

export function AppLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const projectId = useRouterState({
    select: (s) => {
      const match = s.matches.find((m) => "projectId" in (m.params || {}));
      return match?.params && "projectId" in match.params
        ? (match.params as { projectId: string }).projectId
        : undefined;
    },
  });
  const { data: me } = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
  });

  const { data: project } = useQuery({
    queryKey: queryKeys.project(projectId || ""),
    queryFn: () => fetchProject(projectId!),
    enabled: !!projectId,
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      navigate({ to: "/login", search: {} });
    },
  });

  // Get current page name from pathname for breadcrumbs
  const getCurrentPageName = (): string | null => {
    if (!projectId) return null;
    
    const basePath = `/projects/${projectId}`;
    if (pathname === basePath) return "Overview";
    
    const pageMap: Record<string, string> = {
      "/schema-evolution": "Schema Evolution",
      "/schema": "Schema",
      "/data": "Data",
      "/logs": "Logs",
      "/webhooks": "Webhooks",
      "/workflows": "Workflows",
      "/policies": "Policies",
      "/relations": "Relations",
      "/views": "Views",
      "/validations": "Validations",
      "/files": "Files",
      "/users": "Users",
      "/rbac": "RBAC",
      "/auth": "Authentication",
    };

    for (const [path, name] of Object.entries(pageMap)) {
      if (pathname.includes(basePath + path)) return name;
    }
    
    return null;
  };

  const workspaceNav: NavItem[] = [
    { label: "Dashboard", to: "/", icon: <Home className="h-4 w-4" />, match: (path) => path === "/" },
    { label: "Projects", to: "/", icon: <FolderKanban className="h-4 w-4" />, match: (path) => path.includes("/projects/") },
  ];

  const projectNav: NavItem[] = projectId
    ? [
        { label: "Overview", to: "/projects/$projectId", params: { projectId }, icon: <LayoutDashboard className="h-4 w-4" />, match: (path) => path === `/projects/${projectId}` },
        { label: "Schema", to: "/projects/$projectId/schema", params: { projectId }, icon: <Database className="h-4 w-4" />, match: (path) => path.includes(`/projects/${projectId}/schema`) && !path.includes("evolution") },
        { label: "Data", to: "/projects/$projectId/data", params: { projectId }, icon: <Table2 className="h-4 w-4" />, match: (path) => path.includes(`/projects/${projectId}/data`) },
        { label: "Logs", to: "/projects/$projectId/logs", params: { projectId }, icon: <ScrollText className="h-4 w-4" />, match: (path) => path.includes(`/projects/${projectId}/logs`) },
        { label: "Webhooks", to: "/projects/$projectId/webhooks", params: { projectId }, icon: <Webhook className="h-4 w-4" />, match: (path) => path.includes(`/projects/${projectId}/webhooks`) },
        { label: "Workflows", to: "/projects/$projectId/workflows", params: { projectId }, icon: <GitBranch className="h-4 w-4" />, match: (path) => path.includes(`/projects/${projectId}/workflows`) },
        { label: "Policies", to: "/projects/$projectId/policies", params: { projectId }, icon: <Shield className="h-4 w-4" />, match: (path) => path.includes(`/projects/${projectId}/policies`) },
        { label: "Schema Evolution", to: "/projects/$projectId/schema-evolution", params: { projectId }, icon: <RefreshCw className="h-4 w-4" />, match: (path) => path.includes(`/projects/${projectId}/schema-evolution`) },
        { label: "Relations", to: "/projects/$projectId/relations", params: { projectId }, icon: <Link2 className="h-4 w-4" />, match: (path) => path.includes(`/projects/${projectId}/relations`) },
        { label: "Views", to: "/projects/$projectId/views", params: { projectId }, icon: <Eye className="h-4 w-4" />, match: (path) => path.includes(`/projects/${projectId}/views`) },
        { label: "Validations", to: "/projects/$projectId/validations", params: { projectId }, icon: <CheckSquare className="h-4 w-4" />, match: (path) => path.includes(`/projects/${projectId}/validations`) },
        { label: "Files", to: "/projects/$projectId/files", params: { projectId }, icon: <FileBox className="h-4 w-4" />, match: (path) => path.includes(`/projects/${projectId}/files`) },
        { label: "Users", to: "/projects/$projectId/users", params: { projectId }, icon: <User className="h-4 w-4" />, match: (path) => path.includes(`/projects/${projectId}/users`) },
        { label: "Authentication", to: "/projects/$projectId/auth", params: { projectId }, icon: <KeyRound className="h-4 w-4" />, match: (path) => path.includes(`/projects/${projectId}/auth`) && !path.includes("/rbac") },
        { label: "RBAC", to: "/projects/$projectId/rbac", params: { projectId }, icon: <Users className="h-4 w-4" />, match: (path) => path.includes(`/projects/${projectId}/rbac`) },
      ]
    : [];

  const renderNavItem = (item: NavItem, collapsed = false) => {
    const active = item.match(pathname);
    return (
      <Link
        key={item.label}
        to={item.to}
        params={item.params}
        onClick={() => setSidebarOpen(false)}
        title={collapsed ? item.label : undefined}
        className={clsx(
          "group flex items-center rounded-xl text-sm font-medium transition-all duration-200",
          collapsed ? "justify-center mx-auto w-10 h-10" : "gap-3 px-3 py-2.5",
          active
            ? collapsed 
              ? "bg-indigo-100 text-indigo-700" 
              : "bg-gradient-to-r from-indigo-50 to-indigo-100/50 text-indigo-700 border border-indigo-200/60 shadow-sm"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
        )}
      >
        {collapsed ? (
          <span className={clsx(
            "flex items-center justify-center transition-colors",
            active ? "text-indigo-600" : "text-slate-500 group-hover:text-slate-700"
          )}>
            {item.icon}
          </span>
        ) : (
          <>
            <span
              className={clsx(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                active
                  ? "bg-indigo-500 text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700"
              )}
            >
              {item.icon}
            </span>
            <span className="flex-1">{item.label}</span>
            {active && <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
          </>
        )}
      </Link>
    );
  };

  const renderSidebarContent = (collapsed = false) => (
    <>
      <nav className={clsx("flex-1 overflow-y-auto", collapsed ? "mt-2 px-1.5 space-y-1" : "mt-3 px-3 space-y-4")}>
        {projectNav.length > 0 && (
          <div>
            <div className={clsx(collapsed ? "flex flex-col items-center gap-0.5" : "space-y-0.5")}>
              {projectNav.map((item) => renderNavItem(item, collapsed))}
            </div>
          </div>
        )}
      </nav>

      <div className={clsx("mt-auto border-t border-slate-200", collapsed ? "p-2" : "p-4")}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Avatar fallback={me?.email || "User"} size="sm" />
            <button
              onClick={() => logoutMutation.mutate()}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar fallback={me?.email || "User"} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {me?.email ?? "Loading..."}
              </p>
              <p className="text-xs text-slate-500">Admin</p>
            </div>
            <button
              onClick={() => logoutMutation.mutate()}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar backdrop - only show when project is selected */}
      {projectId && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar - only show when project is selected */}
      {projectId && (
        <aside
          className={clsx(
            "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-xl transition-transform duration-300 lg:hidden",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
            <span className="text-lg font-bold text-slate-900">Menu</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-1 flex-col overflow-hidden py-4">
            {renderSidebarContent(false)}
          </div>
        </aside>
      )}

      {/* Desktop sidebar - only show when project is selected */}
      {projectId && (
        <aside 
          className={clsx(
            "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-slate-200 bg-white lg:flex transition-all duration-300 ease-in-out",
            sidebarCollapsed ? "w-[72px]" : "w-64"
          )}
        >
          <div className={clsx(
            "flex h-16 items-center border-b border-slate-200 transition-all duration-300",
            sidebarCollapsed ? "justify-center px-2" : "justify-between px-4"
          )}>
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-sm font-bold text-white shadow-sm flex-shrink-0">
                {project?.name?.charAt(0).toUpperCase() || "P"}
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{project?.name || "Project"}</p>
                  <p className="text-[11px] text-slate-500">Control Center</p>
                </div>
              )}
            </div>
            {!sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors flex-shrink-0"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-1 flex-col overflow-hidden pb-4">
            {renderSidebarContent(sidebarCollapsed)}
          </div>
          {sidebarCollapsed && (
            <div className="border-t border-slate-200 p-2">
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="w-full flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                title="Expand sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            </div>
          )}
        </aside>
      )}

      {/* Main content */}
      <div className={clsx(
        "transition-all duration-300 ease-in-out", 
        projectId ? (sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-64") : "lg:pl-0"
      )}>
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-xl sm:px-6">
          {projectId && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-sm">
            <Link
              to="/"
              className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-600 to-blue-500 text-xs font-bold text-white shadow-sm">
                B
              </div>
              <span className="hidden sm:inline font-medium">Backendify</span>
            </Link>
            {projectId && (
              <>
                <ChevronRight className="h-4 w-4 text-slate-300" />
                <Link
                  to="/"
                  className="font-medium text-slate-500 hover:text-slate-900 transition-colors"
                >
                  Projects
                </Link>
                <ChevronRight className="h-4 w-4 text-slate-300" />
                <span className="font-semibold text-slate-900">{getCurrentPageName() || "Overview"}</span>
              </>
            )}
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
              <Bell className="h-5 w-5" />
            </button>
            <button className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
              <Settings className="h-5 w-5" />
            </button>
            <div className="hidden items-center gap-3 border-l border-slate-200 pl-4 sm:flex">
              <Avatar fallback={me?.email || "User"} size="sm" />
              <div className="hidden md:block">
                <p className="text-sm font-medium text-slate-900">
                  {me?.email?.split("@")[0] ?? "User"}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
