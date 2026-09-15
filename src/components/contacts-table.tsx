'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { formatDate } from '@/lib/utils';
import type { Contact } from '@/lib/types';

interface ContactsTableProps {
  contacts: Contact[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  search: string;
  statusFilter: string;
  consentFilter: string;
}

export function ContactsTable({
  contacts,
  totalCount,
  currentPage,
  totalPages,
  pageSize,
  search,
  statusFilter,
  consentFilter,
}: ContactsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(search);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    // Reset to page 1 when filters change
    if (!updates.page) {
      params.delete('page');
    }
    router.push(`/contacts?${params.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ search: searchInput });
  }

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearchInput(''); updateParams({ search: '' }); }}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              Clear
            </button>
          )}
        </form>
        <select
          value={statusFilter}
          onChange={(e) => updateParams({ status: e.target.value })}
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="bounced">Bounced</option>
          <option value="unsubscribed">Unsubscribed</option>
          <option value="pending">Pending</option>
          <option value="unknown">Unknown</option>
        </select>
        <select
          value={consentFilter}
          onChange={(e) => updateParams({ consent: e.target.value })}
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All consent</option>
          <option value="true">Consented</option>
          <option value="false">Not consented</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Email</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Phone</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Consent</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">City</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Signup</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium">{contact.full_name || '—'}</td>
                  <td className="p-3 text-muted-foreground max-w-[200px] truncate">
                    {contact.email || '—'}
                  </td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">
                    {contact.phone || '—'}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={contact.status} />
                  </td>
                  <td className="p-3 hidden sm:table-cell">
                    <ConsentBadge consent={contact.consent_marketing} />
                  </td>
                  <td className="p-3 text-muted-foreground hidden lg:table-cell">
                    {contact.city || '—'}
                  </td>
                  <td className="p-3 text-muted-foreground hidden lg:table-cell tabular-nums">
                    {formatDate(contact.signup_at)}
                  </td>
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No contacts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startItem}–{endItem} of {totalCount.toLocaleString()}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => updateParams({ page: String(currentPage - 1) })}
              disabled={currentPage <= 1}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="flex items-center px-3 text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => updateParams({ page: String(currentPage + 1) })}
              disabled={currentPage >= totalPages}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    bounced: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    unsubscribed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    pending: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    unknown: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status] || colors.unknown}`}>
      {status}
    </span>
  );
}

function ConsentBadge({ consent }: { consent: boolean | null }) {
  if (consent === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return consent ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
      Yes
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
      No
    </span>
  );
}
