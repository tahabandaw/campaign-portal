'use client';

import { useState } from 'react';
import { formatNumber } from '@/lib/utils';

interface SendCampaignButtonProps {
  campaignId: string;
  campaignName: string;
  channel: string;
  isOwner: boolean;
  hasPendingSend: boolean;
}

export function SendCampaignButton({ campaignId, campaignName, channel, isOwner, hasPendingSend }: SendCampaignButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOwner) return null;

  if (hasPendingSend || successMsg) {
    return (
      <button 
        disabled
        className="px-4 py-2 bg-muted text-muted-foreground rounded-md text-sm font-medium opacity-50 cursor-not-allowed"
      >
        Already sent
      </button>
    );
  }

  const openModal = async () => {
    setIsOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/recipients`);
      if (!res.ok) throw new Error('Failed to fetch recipients');
      const data = await res.json();
      setRecipientCount(data.count);
    } catch (err) {
      setError('Could not fetch recipient count.');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotency_key: crypto.randomUUID() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send campaign');
      }
      const data = await res.json();
      setSuccessMsg(`Campaign queued. Batch ID: ${data.batch_id}`);
      setTimeout(() => setIsOpen(false), 3000);
    } catch (err: any) {
      setError(err.message || 'An error occurred while sending');
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={openModal}
        className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors"
      >
        Send Campaign
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card text-card-foreground p-6 rounded-xl shadow-lg w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Send Campaign</h2>
            
            {loading ? (
              <p className="text-sm text-muted-foreground my-4">Calculating recipients...</p>
            ) : error ? (
              <p className="text-sm text-destructive my-4">{error}</p>
            ) : successMsg ? (
              <p className="text-sm text-green-600 dark:text-green-400 my-4 font-medium">{successMsg}</p>
            ) : (
              <p className="text-sm text-muted-foreground my-4">
                This will send <strong>{campaignName}</strong> via <strong>{channel}</strong> to <strong>{recipientCount !== null ? formatNumber(recipientCount) : '...'}</strong> contactable recipients.
              </p>
            )}

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setIsOpen(false)}
                disabled={sending || !!successMsg}
                className="px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80 rounded-md text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={loading || sending || !!error || !!successMsg}
                className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
