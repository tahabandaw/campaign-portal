'use client';

import { useState, use, useEffect } from 'react';
import { formatNumber, formatCurrency, formatDate } from '@/lib/utils';

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [campaign, setCampaign] = useState<any>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0 || isSubmitting) return;

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/share/${token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        setCooldown(3);
      } else {
        setCampaign(data);
        setVerified(true);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setCooldown(3);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (verified && campaign) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <main className="flex-grow max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-12">
          <div className="bg-white rounded-xl shadow-sm border p-5 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">{campaign.campaign_name}</h1>
            <p className="text-gray-500 mb-6 sm:mb-8 text-sm sm:text-base">
              Channel: <span className="uppercase">{campaign.channel}</span> • Sent: {formatDate(campaign.sent_at)}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-sm text-gray-500 mb-1">Sent</p>
                <p className="text-2xl font-semibold">{formatNumber(campaign.metrics.sent)}</p>
              </div>
              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-sm text-gray-500 mb-1">Delivered</p>
                <p className="text-2xl font-semibold">{formatNumber(campaign.metrics.delivered)}</p>
              </div>
              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-sm text-gray-500 mb-1">Bounced</p>
                <p className="text-2xl font-semibold">{formatNumber(campaign.metrics.bounced)}</p>
              </div>
              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-sm text-gray-500 mb-1">Opens</p>
                <p className="text-2xl font-semibold">{formatNumber(campaign.metrics.opens)}</p>
              </div>
              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-sm text-gray-500 mb-1">Clicks</p>
                <p className="text-2xl font-semibold">{formatNumber(campaign.metrics.clicks)}</p>
              </div>
              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-sm text-gray-500 mb-1">Spend</p>
                <p className="text-2xl font-semibold">{formatCurrency(campaign.metrics.spend)}</p>
              </div>
            </div>
          </div>
        </main>
        
        <footer className="py-6 text-center text-sm text-gray-400">
          Powered by Velocity Growth
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border">
        <h2 className="text-2xl font-bold mb-6 text-center">View Campaign Results</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter password"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting || cooldown > 0}
            className="w-full bg-black text-white py-2 rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Verifying...' : cooldown > 0 ? `Wait ${cooldown}s` : 'View Results'}
          </button>
        </form>
      </div>
      <footer className="mt-8 text-sm text-gray-400">
        Powered by Velocity Growth
      </footer>
    </div>
  );
}
