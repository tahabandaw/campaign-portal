import { createClient } from '@/lib/supabase/server';
import { formatNumber, formatCurrency, formatPercent, formatDate } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const supabase = await createClient();

  // Get current user and brand
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div>Not authenticated</div>;
  }

  const { data: brandUser } = await supabase
    .from('brand_users')
    .select('brand_id')
    .eq('user_id', user.id)
    .single();

  if (!brandUser) {
    return <div>No brand assigned</div>;
  }

  // Fetch campaigns
  const { data: campaigns, count } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact' })
    .eq('brand_id', brandUser.brand_id)
    .order('sent_at_utc', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
        <div className="text-sm text-muted-foreground">
          Total: {count || 0}
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {campaigns?.map((campaign) => (
          <Link
            key={campaign.id}
            href={`/campaigns/${campaign.id}`}
            className="block rounded-xl border bg-card p-4 shadow-sm hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground truncate">
                  {campaign.campaign_name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {campaign.sent_at_utc ? formatDate(campaign.sent_at_utc) : 'Not sent'}
                </p>
              </div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize flex-shrink-0 ${
                  campaign.channel === 'email'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                }`}
              >
                {campaign.channel}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t text-xs">
              <div>
                <div className="text-muted-foreground">Sent</div>
                <div className="font-semibold tabular-nums mt-0.5">{formatNumber(campaign.reported_sent)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Delivered</div>
                <div className="font-semibold tabular-nums mt-0.5">{formatNumber(campaign.reported_delivered)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Spend</div>
                <div className="font-semibold tabular-nums mt-0.5">{formatCurrency(campaign.spend)}</div>
              </div>
              <div className="pt-1">
                <div className="text-muted-foreground">Opens</div>
                <div className="font-semibold tabular-nums mt-0.5">{formatNumber(campaign.reported_opens)}</div>
              </div>
              <div className="pt-1">
                <div className="text-muted-foreground">Clicks</div>
                <div className="font-semibold tabular-nums mt-0.5">{formatNumber(campaign.reported_clicks)}</div>
              </div>
              <div className="pt-1">
                <div className="text-muted-foreground">Bounced</div>
                <div className="font-semibold tabular-nums mt-0.5">{formatNumber(campaign.reported_bounced)}</div>
              </div>
            </div>
          </Link>
        ))}
        {!campaigns?.length && (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
            No campaigns found.
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-sm text-left whitespace-nowrap">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Channel</th>
                <th className="px-6 py-3 font-medium text-right">Sent</th>
                <th className="px-6 py-3 font-medium text-right">Delivered</th>
                <th className="px-6 py-3 font-medium text-right">Bounced</th>
                <th className="px-6 py-3 font-medium text-right">Opens</th>
                <th className="px-6 py-3 font-medium text-right">Clicks</th>
                <th className="px-6 py-3 font-medium text-right">Spend</th>
                <th className="px-6 py-3 font-medium text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {campaigns?.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">
                    <Link href={`/campaigns/${campaign.id}`} className="hover:underline">
                      {campaign.campaign_name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        campaign.channel === 'email'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}
                    >
                      {campaign.channel}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums">{formatNumber(campaign.reported_sent)}</td>
                  <td className="px-6 py-4 text-right tabular-nums">{formatNumber(campaign.reported_delivered)}</td>
                  <td className="px-6 py-4 text-right tabular-nums">{formatNumber(campaign.reported_bounced)}</td>
                  <td className="px-6 py-4 text-right tabular-nums">{formatNumber(campaign.reported_opens)}</td>
                  <td className="px-6 py-4 text-right tabular-nums">{formatNumber(campaign.reported_clicks)}</td>
                  <td className="px-6 py-4 text-right tabular-nums">{formatCurrency(campaign.spend)}</td>
                  <td className="px-6 py-4 text-right text-muted-foreground">
                    {campaign.sent_at_utc ? formatDate(campaign.sent_at_utc) : 'Not sent'}
                  </td>
                </tr>
              ))}
              {!campaigns?.length && (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">
                    No campaigns found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
