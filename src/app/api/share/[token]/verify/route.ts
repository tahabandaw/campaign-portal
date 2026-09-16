import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import bcrypt from 'bcryptjs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    const { data: share, error: shareError } = await adminSupabase
      .from('campaign_shares')
      .select('*')
      .eq('token', token)
      .single();

    if (shareError || !share) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Link expired' }, { status: 410 });
    }

    const isMatch = await bcrypt.compare(password, share.password_hash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: campaign, error: campaignError } = await adminSupabase
      .from('campaigns')
      .select('campaign_name, channel, reported_sent, reported_delivered, reported_bounced, reported_opens, reported_clicks, spend, sent_at_utc, created_at')
      .eq('id', share.campaign_id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign data not found' }, { status: 404 });
    }

    return NextResponse.json({
      campaign_name: campaign.campaign_name,
      channel: campaign.channel,
      metrics: {
        sent: campaign.reported_sent || 0,
        delivered: campaign.reported_delivered || 0,
        bounced: campaign.reported_bounced || 0,
        opens: campaign.reported_opens || 0,
        clicks: campaign.reported_clicks || 0,
        spend: campaign.spend || 0,
      },
      sent_at: campaign.sent_at_utc || campaign.created_at,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
