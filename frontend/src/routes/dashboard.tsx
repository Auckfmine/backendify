import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";

import { createProject, fetchProjects, Project } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { Button, Card, Input, SectionTitle } from "../components/ui";

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { data: projects } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: fetchProjects,
  });
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: () => createProject(name),
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <SectionTitle>Create project</SectionTitle>
        <form className="mt-4 flex gap-3" onSubmit={handleSubmit}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" required />
          <Button type="submit">{mutation.isPending ? "Creating..." : "Create"}</Button>
        </form>
      </Card>

      <Card className="p-6">
        <SectionTitle>Your projects</SectionTitle>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(projects || []).map((project: Project) => (
            <div key={project.id} className="rounded-lg border border-slate-200 p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold">{project.name}</div>
                <div className="text-xs text-slate-500">{project.id}</div>
              </div>
              <Link to="/projects/$projectId" params={{ projectId: project.id }} className="text-primary text-sm font-medium">
                View
              </Link>
            </div>
          ))}
          {!projects?.length ? <p className="text-sm text-slate-500">No projects yet.</p> : null}
        </div>
      </Card>
    </div>
  );
}
