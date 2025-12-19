import {
  Outlet,
  Route,
  RootRoute,
  Router,
  redirect,
} from "@tanstack/react-router";

import { AppLayout } from "./components/AppLayout";
import { DashboardPage } from "./routes/dashboard";
import { LoginPage } from "./routes/login";
import { ProjectPage } from "./routes/project";
import { RegisterPage } from "./routes/register";
import SchemaPage from "./routes/schema";
import DataExplorerPage from "./routes/data";
import LogsPage from "./routes/logs";
import WebhooksPage from "./routes/webhooks";
import WorkflowsPage from "./routes/workflows";
import PoliciesPage from "./routes/policies";
import SchemaEvolutionPage from "./routes/schema-evolution";
import RelationsPage from "./routes/relations";
import ViewsPage from "./routes/views";
import ValidationsPage from "./routes/validations";
import FilesPage from "./routes/files";
import { AuthPage } from "./routes/auth";
import RbacPage from "./routes/rbac";
import UsersPage from "./routes/users";
import { isAuthenticated } from "./lib/auth";
import { queryClient } from "./lib/queryClient";

const rootRoute = new RootRoute({
  component: () => <Outlet />,
});

const loginRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPage,
});

const registerRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: RegisterPage,
});

const authedRoute = new Route({
  getParentRoute: () => rootRoute,
  id: "app",
  beforeLoad: ({ location }) => {
    if (!isAuthenticated()) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href ?? location.pathname },
      });
    }
  },
  component: AppLayout,
});

const dashboardRoute = new Route({
  getParentRoute: () => authedRoute,
  path: "/",
  component: DashboardPage,
});

const projectRoute = new Route({
  getParentRoute: () => authedRoute,
  path: "projects/$projectId",
  component: ProjectPage,
});

const schemaRoute = new Route({
  getParentRoute: () => authedRoute,
  path: "projects/$projectId/schema",
  component: SchemaPage,
});

const dataRoute = new Route({
  getParentRoute: () => authedRoute,
  path: "projects/$projectId/data",
  component: DataExplorerPage,
});

const logsRoute = new Route({
  getParentRoute: () => authedRoute,
  path: "projects/$projectId/logs",
  component: LogsPage,
});

const webhooksRoute = new Route({
  getParentRoute: () => authedRoute,
  path: "projects/$projectId/webhooks",
  component: WebhooksPage,
});

const workflowsRoute = new Route({
  getParentRoute: () => authedRoute,
  path: "projects/$projectId/workflows",
  component: WorkflowsPage,
});

const policiesRoute = new Route({
  getParentRoute: () => authedRoute,
  path: "projects/$projectId/policies",
  component: PoliciesPage,
});

const schemaEvolutionRoute = new Route({
  getParentRoute: () => authedRoute,
  path: "projects/$projectId/schema-evolution",
  component: SchemaEvolutionPage,
});

const relationsRoute = new Route({
  getParentRoute: () => authedRoute,
  path: "projects/$projectId/relations",
  component: RelationsPage,
});

const viewsRoute = new Route({
  getParentRoute: () => authedRoute,
  path: "projects/$projectId/views",
  component: ViewsPage,
});

const validationsRoute = new Route({
  getParentRoute: () => authedRoute,
  path: "projects/$projectId/validations",
  component: ValidationsPage,
});

const filesRoute = new Route({
  getParentRoute: () => authedRoute,
  path: "projects/$projectId/files",
  component: FilesPage,
});

const authRoute = new Route({
  getParentRoute: () => authedRoute,
  path: "projects/$projectId/auth",
  component: AuthPage,
});

const rbacRoute = new Route({
  getParentRoute: () => authedRoute,
  path: "projects/$projectId/rbac",
  component: RbacPage,
});

const usersRoute = new Route({
  getParentRoute: () => authedRoute,
  path: "projects/$projectId/users",
  component: UsersPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  authedRoute.addChildren([dashboardRoute, projectRoute, schemaRoute, dataRoute, logsRoute, webhooksRoute, workflowsRoute, policiesRoute, schemaEvolutionRoute, relationsRoute, viewsRoute, validationsRoute, filesRoute, authRoute, rbacRoute, usersRoute]),
]);

export const router = new Router({
  routeTree,
  context: { queryClient },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
