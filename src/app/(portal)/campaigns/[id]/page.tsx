import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { formatNumber, formatCurrency, formatPercent, formatDateTime, deliveryRate, openRate, clickRate } from '@/lib/utils';
import { SendCampaignButton } from '@/components/send-campaign-button';
import { ShareResultsButton } from '@/components/share-results-button';

export const dynamic = 'force-dynamic';

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div>Not authenticated</div>;
  }

  const { data: brandUser } = await supabase
    .from('brand_users')
    .select('brand_id, role')
    .eq('user_id', user.id)
    .single();

  if (!brandUser) {
    return <div>No brand assigned</div>;
  }

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .eq('brand_id', brandUser.brand_id)
    .single();

  if (!campaign) {
    notFound();
  }

  const { data: sendBatches } = await supabase
    .from('send_batches')
    .select('*')
    .eq('campaign_id', campaign.id)
    .order('queued_at', { ascending: false });

  const { data: shares } = await supabase
    .from('campaign_shares')
    .select('*')
    .eq('campaign_id', campaign.id)
    .order('created_at', { ascending: false });

  const isOwner = brandUser.role === 'owner';
  
  const hasPendingSend = sendBatches?.some(
    batch => batch.status === 'sent' || batch.status === 'sending' || batch.status === 'pending'
  ) ?? false;

  const deliveredRate = deliveryRate(campaign.reported_delivered, campaign.reported_sent);
  const openedRate = openRate(campaign.reported_opens, campaign.reported_delivered);
  const clickedRate = clickRate(campaign.reported_clicks, campaign.reported_delivered);

  const opensExceedDelivered = campaign.reported_opens > campaign.reported_delivered;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{campaign.campaign_name}</h1>
          <div className="flex items-center mt-2 space-x-2 text-sm text-muted-foreground">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                campaign.channel === 'email'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              }`}
            >
              {campaign.channel}
            </span>
            <span>•</span>
            <span>Sent: {campaign.sent_at_utc ? formatDateTime(campaign.sent_at_utc) : 'Not sent'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isOwner && (
            <>
              <ShareResultsButton campaignId={campaign.id} isOwner={isOwner} />
              <SendCampaignButton 
                campaignId={campaign.id} 
                campaignName={campaign.campaign_name}
                channel={campaign.channel}
                isOwner={isOwner}
                hasPendingSend={hasPendingSend}
              />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Sent</h3>
          <p className="text-3xl font-semibold mt-2 tabular-nums">{formatNumber(campaign.reported_sent)}</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Delivered</h3>
          <p className="text-3xl font-semibold mt-2 tabular-nums">{formatNumber(campaign.reported_delivered)}</p>
          <p className="text-sm text-muted-foreground mt-1">Rate: {formatPercent(deliveredRate)}</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Bounced</h3>
          <p className="text-3xl font-semibold mt-2 tabular-nums">{formatNumber(campaign.reported_bounced)}</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Opens</h3>
          <p className="text-3xl font-semibold mt-2 tabular-nums">{formatNumber(campaign.reported_opens)}</p>
          <p className="text-sm text-muted-foreground mt-1">Rate: {formatPercent(openedRate)}</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Clicks</h3>
          <p className="text-3xl font-semibold mt-2 tabular-nums">{formatNumber(campaign.reported_clicks)}</p>
          <p className="text-sm text-muted-foreground mt-1">Rate: {formatPercent(clickedRate)}</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Spend</h3>
          <p className="text-3xl font-semibold mt-2 tabular-nums">{formatCurrency(campaign.spend)}</p>
        </div>
      </div>

      {opensExceedDelivered && (
        <div className="p-4 rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-sm border border-amber-200 dark:border-amber-800">
          <strong>Note:</strong> Opens can exceed delivered when recipients open multiple times.
        </div>
      )}

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight mb-4">Send History</h2>
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-sm text-left whitespace-nowrap">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Recipients</th>
                    <th className="px-6 py-3 font-medium text-right">Queued At</th>
                    <th className="px-6 py-3 font-medium text-right">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sendBatches?.map((batch) => (
                    <tr key={batch.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium capitalize">
                        {batch.status}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums">{formatNumber(batch.recipient_count)}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground">{formatDateTime(batch.queued_at)}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground">{formatDateTime(batch.sent_at)}</td>
                    </tr>
                  ))}
                  {!sendBatches?.length && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                        No send history found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {isOwner && (
          <div>
            <h2 className="text-xl font-bold tracking-tight mb-4">Share Links</h2>
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-sm text-left whitespace-nowrap">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 font-medium">Created At</th>
                      <th className="px-6 py-3 font-medium">Expires At</th>
                      <th className="px-6 py-3 font-medium">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {shares?.map((share) => (
                      <tr key={share.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 text-muted-foreground">{formatDateTime(share.created_at)}</td>
                        <td className="px-6 py-4 text-muted-foreground">{formatDateTime(share.expires_at)}</td>
                        <td className="px-6 py-4 text-muted-foreground">
                          <code className="bg-muted px-2 py-1 rounded">
                            /share/{share.token}
                          </code>
                        </td>
                      </tr>
                    ))}
                    {!shares?.length && (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">
                          No share links created.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
