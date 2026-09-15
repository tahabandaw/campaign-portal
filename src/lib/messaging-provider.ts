import {
  DispatcherSendRequest,
  DispatcherSendResponse,
  DispatcherEventsResponse,
} from './types';

const BASE_URL = 'https://dispatcher-production-72fc.up.railway.app';

function getApiKey(): string {
  const key = process.env.DISPATCHER_API_KEY;
  if (!key) {
    throw new Error('Missing DISPATCHER_API_KEY environment variable');
  }
  return key;
}

/**
 * Send a batch of messages through the messaging provider.
 * 
 * Supports Idempotency-Key to prevent duplicate sends on retry.
 * Recipients can be up to 100,000 per call.
 */
export async function sendMessages(
  request: DispatcherSendRequest,
  idempotencyKey: string
): Promise<DispatcherSendResponse> {
  const response = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': getApiKey(),
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Dispatcher API error ${response.status}: ${errorText}`
    );
  }

  return response.json();
}

/**
 * Poll delivery events for a batch.
 * 
 * Pass `since` (the last event_id you processed) for incremental polling.
 * The response includes `has_more` and `next_cursor` for pagination.
 * Event types: delivered, bounced, opened, unsubscribed
 */
export async function getEvents(
  batchId: string,
  since?: string | null
): Promise<DispatcherEventsResponse> {
  const params = new URLSearchParams();
  if (since) {
    params.set('since', since);
  }

  const url = `${BASE_URL}/v1/messages/${batchId}/events${params.toString() ? '?' + params.toString() : ''}`;
  
  const response = await fetch(url, {
    headers: {
      'X-API-Key': getApiKey(),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Dispatcher API error ${response.status}: ${errorText}`
    );
  }

  return response.json();
}

/**
 * Check messaging provider health.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/healthz`);
    return response.ok;
  } catch {
    return false;
  }
}
