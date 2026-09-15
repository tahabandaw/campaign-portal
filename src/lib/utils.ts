import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number with comma separators.
 * e.g. 84013 → "84,013"
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Format a percentage.
 * e.g. 0.952 → "95.2%"
 */
export function formatPercent(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

/**
 * Format currency (USD).
 * e.g. 650.07 → "$650.07"
 */
export function formatCurrency(n: number): string {
  return `\$${n.toFixed(2)}`;
}

/**
 * Format a date for display.
 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a datetime for display.
 */
export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Generate a URL-safe random token.
 */
export function generateToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

/**
 * Compute delivery rate: delivered / sent
 */
export function deliveryRate(delivered: number, sent: number): number {
  if (sent === 0) return 0;
  return delivered / sent;
}

/**
 * Compute open rate: opens / delivered
 * Note: opens can exceed delivered (multiple opens per recipient)
 */
export function openRate(opens: number, delivered: number): number {
  if (delivered === 0) return 0;
  return opens / delivered;
}

/**
 * Compute click rate: clicks / delivered
 */
export function clickRate(clicks: number, delivered: number): number {
  if (delivered === 0) return 0;
  return clicks / delivered;
}
