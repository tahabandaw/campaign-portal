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

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
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
