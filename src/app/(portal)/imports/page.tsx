import { createClient } from '@/lib/supabase/server';
import { formatNumber, formatDateTime } from '@/lib/utils';
import { ImportLog } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ImportsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div>Not authenticated</div>;
  }

  const { data: brandUser } = await supabase
    .from('brand_users')
    .select('brand_id')
    .eq('user_id', user.id)
    .single();

  if (!brandUser) {
    return <div>No brand assigned</div>;
  }

  // Use the generated type for this, but specify exact output as it contains jsonb
  const { data: importLogs } = await supabase
    .from('import_logs')
    .select('*')
    .eq('brand_id', brandUser.brand_id)
    .order('imported_at', { ascending: false });

  // Typecast safely
  const logs = (importLogs || []) as unknown as ImportLog[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Logs</h1>
        <p className="text-muted-foreground mt-1">View the history of your contact imports and troubleshoot any issues.</p>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground truncate">{log.file_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{formatDateTime(log.imported_at)}</div>
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize flex-shrink-0 ${
                  log.status === 'completed'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : log.status === 'failed'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                }`}
              >
                {log.status}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-2 border-t text-xs text-center">
              <div>
                <div className="text-muted-foreground">Total</div>
                <div className="font-semibold tabular-nums mt-0.5">{formatNumber(log.total_rows)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Imported</div>
                <div className="font-semibold tabular-nums text-green-600 dark:text-green-400 mt-0.5">{formatNumber(log.rows_imported)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Updated</div>
                <div className="font-semibold tabular-nums text-blue-600 dark:text-blue-400 mt-0.5">{formatNumber(log.rows_updated)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Skipped</div>
                <div className="font-semibold tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">{formatNumber(log.rows_skipped)}</div>
              </div>
            </div>

            {(log.errors?.length > 0 || log.warnings?.length > 0) && (
              <details className="pt-2 border-t text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  View details ({log.errors?.length || 0} errors, {log.warnings?.length || 0} warnings)
                </summary>
                <div className="mt-2 space-y-2 pl-2 border-l-2 border-muted max-h-48 overflow-y-auto">
                  {log.errors?.slice(0, 10).map((err, i) => (
                    <div key={i} className="text-destructive">
                      <strong>Row {err.row}:</strong> {err.reason}
                      {err.field && <span> (Field: {err.field})</span>}
                    </div>
                  ))}
                  {log.errors?.length > 10 && (
                    <div className="text-muted-foreground italic">
                      ...and {log.errors.length - 10} more errors
                    </div>
                  )}
                  {log.warnings?.slice(0, 10).map((warn, i) => (
                    <div key={i} className="text-amber-600 dark:text-amber-400">
                      <strong>Row {warn.row}:</strong> {warn.reason}
                      {warn.field && <span> (Field: {warn.field})</span>}
                    </div>
                  ))}
                  {log.warnings?.length > 10 && (
                    <div className="text-muted-foreground italic">
                      ...and {log.warnings.length - 10} more warnings
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        ))}
        {!logs.length && (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
            No import logs found.
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm text-left whitespace-nowrap">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">File Name</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium text-right">Total Rows</th>
                <th className="px-6 py-3 font-medium text-right">Imported</th>
                <th className="px-6 py-3 font-medium text-right">Updated</th>
                <th className="px-6 py-3 font-medium text-right">Skipped</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-medium text-foreground">{log.file_name}</div>
                    {(log.errors?.length > 0 || log.warnings?.length > 0) && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          View details ({log.errors?.length || 0} errors, {log.warnings?.length || 0} warnings)
                        </summary>
                        <div className="mt-2 space-y-2 pl-2 border-l-2 border-muted">
                          {log.errors?.slice(0, 10).map((err, i) => (
                            <div key={i} className="text-destructive">
                              <strong>Row {err.row}:</strong> {err.reason}
                              {err.field && <span> (Field: {err.field})</span>}
                            </div>
                          ))}
                          {log.errors?.length > 10 && (
                            <div className="text-muted-foreground italic">
                              ...and {log.errors.length - 10} more errors
                            </div>
                          )}
                          
                          {log.warnings?.slice(0, 10).map((warn, i) => (
                            <div key={i} className="text-amber-600 dark:text-amber-400">
                              <strong>Row {warn.row}:</strong> {warn.reason}
                              {warn.field && <span> (Field: {warn.field})</span>}
                            </div>
                          ))}
                          {log.warnings?.length > 10 && (
                            <div className="text-muted-foreground italic">
                              ...and {log.warnings.length - 10} more warnings
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                    {formatDateTime(log.imported_at)}
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums">{formatNumber(log.total_rows)}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-green-600 dark:text-green-400">{formatNumber(log.rows_imported)}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-blue-600 dark:text-blue-400">{formatNumber(log.rows_updated)}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-amber-600 dark:text-amber-400">{formatNumber(log.rows_skipped)}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        log.status === 'completed'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : log.status === 'failed'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!logs.length && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    No import logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
