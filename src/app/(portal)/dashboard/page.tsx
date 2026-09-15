import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  // We can fetch data here using the server client later
  const supabase = await createClient();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to your campaign portal overview.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Placeholder cards */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
            <div className="h-12 flex items-center justify-center">
              <span className="text-sm text-muted-foreground">Stats arriving soon</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
