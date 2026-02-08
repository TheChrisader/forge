import { useParams } from "@tanstack/react-router";

export function ProjectDetailPage() {
  const { projectId } = useParams({ from: "/projects/$projectId" });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Project: {projectId}</h1>
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-muted-foreground">Project details will go here</p>
      </div>
    </div>
  );
}
