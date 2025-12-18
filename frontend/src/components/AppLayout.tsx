import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { logout, fetchMe } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "./ui";

export function AppLayout() {
  const navigate = useNavigate();
  const { data: me } = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      navigate({ to: "/login", search: {} });
    },
  });

  return (
    <div className="min-h-screen text-slate-900">
      <header className="flex items-center justify-between px-6 py-4 backdrop-blur bg-white/70 border-b border-slate-200 sticky top-0">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
            B
          </div>
          <div className="flex flex-col">
            <span className="text-sm uppercase tracking-wide text-slate-500">Backendify</span>
            <span className="text-lg font-semibold">Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {me ? <span className="text-sm text-slate-600">{me.email}</span> : null}
          <Button onClick={() => logoutMutation.mutate()} className="bg-slate-900 hover:bg-slate-800">
            Logout
          </Button>
        </div>
      </header>
      <main className="p-6">
        <nav className="mb-6 flex gap-4 text-sm font-medium">
          <Link to="/" className="text-slate-600 hover:text-primary">
            Dashboard
          </Link>
        </nav>
        <Outlet />
      </main>
    </div>
  );
}
