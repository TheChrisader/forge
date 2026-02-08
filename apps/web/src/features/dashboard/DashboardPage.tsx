export function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="text-sm text-muted-foreground">Projects</div>
          <div className="mt-2 text-3xl font-bold">12</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="text-sm text-muted-foreground">Services</div>
          <div className="mt-2 text-3xl font-bold">24</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="text-sm text-muted-foreground">Deployments</div>
          <div className="mt-2 text-3xl font-bold">156</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="text-sm text-muted-foreground">Containers</div>
          <div className="mt-2 text-3xl font-bold">48</div>
        </div>
      </div>
    </div>
  );
}
