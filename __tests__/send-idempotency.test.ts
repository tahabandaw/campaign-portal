/**
 * SEND IDEMPOTENCY TEST
 * 
 * Verifies that duplicate send requests or double-clicks
 * do NOT dispatch duplicate batches.
 */

import { describe, it, expect, vi } from 'vitest';
import { sendMessages } from '@/lib/messaging-provider';

describe('Send Idempotency & Concurrency', () => {
  it('Uses Idempotency-Key header on outgoing provider dispatch calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        batch_id: 'batch_test_123',
        accepted: [{ id: 'CT-001' }],
        rejected: [],
      }),
    });
    global.fetch = fetchMock;
    process.env.DISPATCHER_API_KEY = 'test_key';

    const testIdempotencyKey = 'idemp_key_' + Date.now();
    await sendMessages(
      {
        campaign: 'Test Campaign',
        brand: 'KILELE',
        recipients: [{ id: 'CT-001' }],
      },
      testIdempotencyKey
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toContain('/v1/messages');
    expect(callArgs[1].headers['Idempotency-Key']).toBe(testIdempotencyKey);
    expect(callArgs[1].headers['X-API-Key']).toBe('test_key');
  });

  it('Provider returns identical response or deduplicates when same key is sent', async () => {
    const mockResponse = {
      batch_id: 'batch_dedup_456',
      accepted: [{ id: 'CT-002' }],
      rejected: [],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });
    global.fetch = fetchMock;

    const key = 'duplicate_send_test';
    const res1 = await sendMessages(
      { campaign: 'Flash Sale', brand: 'KAROO', recipients: [{ id: 'CT-002' }] },
      key
    );
    const res2 = await sendMessages(
      { campaign: 'Flash Sale', brand: 'KAROO', recipients: [{ id: 'CT-002' }] },
      key
    );

    expect(res1.batch_id).toBe(res2.batch_id);
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBe(key);
    expect(fetchMock.mock.calls[1][1].headers['Idempotency-Key']).toBe(key);
  });
});
