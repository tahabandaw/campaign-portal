import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMessages } from '@/lib/messaging-provider';
import type { DispatcherRecipient, DispatcherSendRequest } from '@/lib/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { idempotency_key } = await request.json();

    if (!idempotency_key) {
      return NextResponse.json({ error: 'idempotency_key is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const { data: brandUser, error: roleError } = await supabase
      .from('brand_users')
      .select('role')
      .eq('brand_id', campaign.brand_id)
      .eq('user_id', user.id)
      .single();

    if (roleError || !brandUser || brandUser.role !== 'owner') {
      return NextResponse.json({ error: 'Must be brand owner to send campaign' }, { status: 403 });
    }

    const { data: existingBatches } = await adminSupabase
      .from('send_batches')
      .select('id, status')
      .eq('campaign_id', id)
      .in('status', ['pending', 'sending']);

    if (existingBatches && existingBatches.length > 0) {
      return NextResponse.json({ error: 'A send batch is already in progress for this campaign' }, { status: 409 });
    }

    let query = adminSupabase
      .from('contacts')
      .select('external_id, email, phone')
      .eq('brand_id', campaign.brand_id)
      .eq('status', 'active')
      .eq('consent_marketing', true)
      .is('deleted_at', null)
      .or('suppressed_until.is.null,suppressed_until.lt.now()')
      .limit(100000);

    if (campaign.target_country) {
      query = query.eq('country', campaign.target_country);
    }

    const { data: contacts, error: contactsError } = await query;

    if (contactsError || !contacts) {
      return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 });
    }

    const { data: batch, error: batchError } = await adminSupabase
      .from('send_batches')
      .insert({
        brand_id: campaign.brand_id,
        campaign_id: id,
        idempotency_key,
        recipient_count: contacts.length,
        status: 'sending',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Failed to create send batch' }, { status: 500 });
    }

    const recipients: DispatcherRecipient[] = contacts.map(c => ({
      id: c.external_id,
      email: c.email,
      phone: c.phone
    }));

    const sendRequest: DispatcherSendRequest = {
      campaign: campaign.campaign_name,
      brand: campaign.brand_id,
      recipients,
    };

    try {
      const response = await sendMessages(sendRequest, idempotency_key);

      const acceptedCount = Array.isArray(response.accepted) ? response.accepted.length : 0;
      const rejectedCount = Array.isArray(response.rejected) ? response.rejected.length : 0;

      await adminSupabase
        .from('send_batches')
        .update({
          batch_key: response.batch_id,
          status: 'sent',
          provider_accepted: acceptedCount,
          provider_rejected: rejectedCount,
        })
        .eq('id', batch.id);

      return NextResponse.json({
        batch_id: batch.id,
        provider_batch_id: response.batch_id,
        recipient_count: contacts.length,
        accepted: acceptedCount,
        rejected: rejectedCount
      });
    } catch (sendError: any) {
      await adminSupabase
        .from('send_batches')
        .update({
          status: 'failed',
          error_message: sendError.message || 'Send failed',
        })
        .eq('id', batch.id);

      return NextResponse.json({ error: 'Failed to send messages' }, { status: 500 });
    }

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
