import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, brand_id, name, channel, target_country')
      .eq('id', id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Base query for contacts
    let query = supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', campaign.brand_id)
      .eq('status', 'active')
      .eq('consent_marketing', true)
      .is('deleted_at', null)
      .or('suppressed_until.is.null,suppressed_until.lt.now()');

    if (campaign.target_country) {
      query = query.eq('country', campaign.target_country);
    }

    const { count, error: countError } = await query;

    if (countError) {
      console.error('Count error:', countError);
      return NextResponse.json({ error: 'Failed to count recipients' }, { status: 500 });
    }

    return NextResponse.json({
      count,
      campaign_name: campaign.name,
      channel: campaign.channel,
      target_country: campaign.target_country,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
