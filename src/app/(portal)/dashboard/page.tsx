import { createClient } from "@/lib/supabase/server";
import { formatNumber, formatCurrency, formatPercent, formatDate } from "@/lib/utils";
import { DashboardCharts } from "@/components/dashboard-charts";
import Link from "next/link";
import { Users, UserCheck, Send, DollarSign, TrendingUp, AlertCircle, ArrowUpRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  // 1. Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Please sign in to view your dashboard.
      </div>
    );
  }

  // 2. Resolve brand
  const { data: brandUser } = await supabase
    .from("brand_users")
    .select("brand_id, role, brands(*)")
    .eq("user_id", user.id)
    .single();

  if (!brandUser || !brandUser.brand_id) {
    return (
      <div className="p-8 text-center text-destructive">
        No brand assigned to this account.
      </div>
    );
  }

  const brandId = brandUser.brand_id;
  const brand = (brandUser as any).brands;

  // 3. Fetch Total Customers
  const { count: totalCustomers } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .is("deleted_at", null);

  // 4. Fetch Contactable Customers (active, marketing consent true, not deleted, not suppressed)
  const now = new Date().toISOString();
  const { count: contactableCustomers } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .is("deleted_at", null)
    .eq("status", "active")
    .eq("consent_marketing", true);

  // 5. Fetch Campaigns
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .eq("brand_id", brandId)
    .order("sent_at_utc", { ascending: false });

  const totalCampaigns = campaigns?.length || 0;
  const totalSpend = campaigns?.reduce((sum, c) => sum + (Number(c.spend) || 0), 0) || 0;
  const totalSent = campaigns?.reduce((sum, c) => sum + (c.reported_sent || 0), 0) || 0;
  const totalDelivered = campaigns?.reduce((sum, c) => sum + (c.reported_delivered || 0), 0) || 0;
  const totalOpens = campaigns?.reduce((sum, c) => sum + (c.reported_opens || 0), 0) || 0;
  const totalClicks = campaigns?.reduce((sum, c) => sum + (c.reported_clicks || 0), 0) || 0;

  const deliveryRate = totalSent > 0 ? totalDelivered / totalSent : 0;
  const contactabilityRate = (totalCustomers && totalCustomers > 0 && contactableCustomers)
    ? (contactableCustomers / totalCustomers)
    : 0;

  // 6. Fetch Signups for activity chart (sample recent 2000 signups)
  const { data: signups } = await supabase
    .from("contacts")
    .select("signup_at")
    .eq("brand_id", brandId)
    .not("signup_at", "is", null)
    .order("signup_at", { ascending: false })
    .limit(2000);

  // Aggregate by date (YYYY-MM-DD)
  const dateCounts: Record<string, number> = {};
  (signups || []).forEach((row) => {
    if (row.signup_at) {
      const dateKey = row.signup_at.split("T")[0];
      dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
    }
  });

  const chartData = Object.entries(dateCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30); // show last 30 active days

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{brand?.name || "Dashboard"}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              {brandUser.role.toUpperCase()}
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time campaign performance & customer growth metrics for {brand?.name} ({brand?.country}).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/campaigns"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            <Send className="w-4 h-4" />
            <span>Manage Campaigns</span>
          </Link>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Customers */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Total Customers</span>
            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold">{formatNumber(totalCustomers || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Full addressable customer base</span>
            </p>
          </div>
        </div>

        {/* Contactable Customers */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Contactable Customers</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold">{formatNumber(contactableCustomers || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-semibold text-emerald-600">{formatPercent(contactabilityRate)}</span> of total (active & consented)
            </p>
          </div>
        </div>

        {/* Total Campaigns & Spend */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Total Spend</span>
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold">{formatCurrency(totalSpend)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across <span className="font-semibold text-foreground">{totalCampaigns}</span> campaigns sent
            </p>
          </div>
        </div>

        {/* Avg Delivery Rate */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Delivery Rate</span>
            <div className="p-2 bg-purple-500/10 text-purple-600 rounded-lg">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold">{formatPercent(deliveryRate)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(totalDelivered)} / {formatNumber(totalSent)} delivered
            </p>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Customer Signup Activity</h2>
            <p className="text-xs text-muted-foreground">
              Daily customer acquisition volume across the last 30 recorded signup days.
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-mono bg-muted px-2.5 py-1 rounded">
            Timezone: {brand?.timezone || "UTC"}
          </span>
        </div>

        {chartData.length > 0 ? (
          <DashboardCharts data={chartData} />
        ) : (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            No signup timeline records available.
          </div>
        )}
      </div>

      {/* Methodology Explainer Note */}
      <div className="rounded-xl border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 p-4 text-sm space-y-2">
        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium">
          <AlertCircle className="w-4 h-4" />
          <span>Growth Engineer Methodology & Definitions</span>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          <strong>Contactable Customers:</strong> A contact is contactable if and only if:
          <code className="mx-1 px-1 bg-background rounded border">status = &apos;active&apos;</code>,
          <code className="mx-1 px-1 bg-background rounded border">consent_marketing = true</code>,
          <code className="mx-1 px-1 bg-background rounded border">deleted_at IS NULL</code>, and
          <code className="mx-1 px-1 bg-background rounded border">suppressed_until IS NULL or &lt; now()</code>.
          Contacts who bounced or unsubscribed are automatically excluded.
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          <strong>Reported Opens:</strong> Open interaction numbers represent gross interaction telemetry events. If a recipient opens an email multiple times, total recorded opens may exceed total unique delivered recipients.
        </p>
      </div>

      {/* Recent Campaigns Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Campaign Performance</h2>
            <p className="text-xs text-muted-foreground">
              Recent campaigns and engagement telemetry for {brand?.name}.
            </p>
          </div>
          <Link
            href="/campaigns"
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            <span>View all {totalCampaigns} campaigns</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b text-xs text-muted-foreground font-medium">
              <tr>
                <th className="py-3 px-6 text-left">Campaign</th>
                <th className="py-3 px-4 text-left">Channel</th>
                <th className="py-3 px-4 text-right">Sent</th>
                <th className="py-3 px-4 text-right">Delivered</th>
                <th className="py-3 px-4 text-right">Opens</th>
                <th className="py-3 px-4 text-right">Clicks</th>
                <th className="py-3 px-4 text-right">Spend</th>
                <th className="py-3 px-6 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(campaigns || []).slice(0, 8).map((c) => (
                <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                  <td className="py-3.5 px-6 font-medium">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="text-foreground hover:text-primary hover:underline"
                    >
                      {c.campaign_name}
                    </Link>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        c.channel === "email"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      }`}
                    >
                      {c.channel.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs">
                    {formatNumber(c.reported_sent || 0)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs">
                    {formatNumber(c.reported_delivered || 0)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs">
                    {formatNumber(c.reported_opens || 0)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs">
                    {formatNumber(c.reported_clicks || 0)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs">
                    {formatCurrency(Number(c.spend) || 0)}
                  </td>
                  <td className="py-3.5 px-6 text-right text-xs text-muted-foreground">
                    {formatDate(c.sent_at_utc)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
