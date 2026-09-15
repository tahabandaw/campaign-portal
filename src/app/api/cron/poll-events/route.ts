import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getEvents } from '@/lib/messaging-provider';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    const { data: batches, error: batchesError } = await adminSupabase
      .from('send_batches')
      .select('*, campaigns(external_id)')
      .eq('status', 'sent');

    if (batchesError || !batches) {
      return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 });
    }

    let processedCount = 0;

    for (const batch of batches) {
      if (!batch.batch_key) continue;

      try {
        let cursor = batch.last_event_cursor;
        let hasMore = true;
        
        while (hasMore) {
          const response = await getEvents(batch.batch_key, cursor);
          
          if (response.events && response.events.length > 0) {
            for (const event of response.events) {
              const campaignExtId = (batch as any).campaigns?.external_id || batch.campaign_id;
              await adminSupabase.from('events').upsert({
                brand_id: batch.brand_id,
                event_id: event.event_id,
                contact_external_id: event.recipient_id,
                campaign_external_id: campaignExtId,
                event_type: event.event_type,
                occurred_at_utc: event.occurred_at,
              }, { onConflict: 'brand_id,event_id' });

              if (event.event_type === 'bounced') {
                await adminSupabase.from('contacts')
                  .update({ status: 'bounced' })
                  .eq('external_id', event.recipient_id)
                  .eq('brand_id', batch.brand_id);
              } else if (event.event_type === 'unsubscribed') {
                await adminSupabase.from('contacts')
                  .update({ status: 'unsubscribed' })
                  .eq('external_id', event.recipient_id)
                  .eq('brand_id', batch.brand_id);
              }
            }
          }

          cursor = response.next_cursor;
          hasMore = response.has_more;
        }

        await adminSupabase.from('send_batches')
          .update({
            last_event_cursor: cursor,
            last_event_poll_at: new Date().toISOString()
          })
          .eq('id', batch.id);

        processedCount++;
      } catch (err) {
        console.error(`Error processing batch ${batch.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, processed_batches: processedCount });
  } catch (error) {
    console.error('Cron Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
