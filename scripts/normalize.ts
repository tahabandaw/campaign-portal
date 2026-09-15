export function detectDelimiter(line: string): string {
  const commas = (line.match(/,/g) || []).length;
  const semicolons = (line.match(/;/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

export function normalizeBoolean(val: string | undefined): boolean | null {
  if (val === undefined || val === null) return null;
  const lower = val.toLowerCase().trim();
  if (lower === '') return null;
  if (['true', '1', 'y', 'yes', 'active', 't'].includes(lower)) return true;
  if (['false', '0', 'no', 'f', 'n'].includes(lower)) return false;
  return null;
}

export function normalizeEmail(val: string | undefined): string | null {
  if (!val) return null;
  const trimmed = val.trim().toLowerCase();
  if (trimmed === '') return null;
  return trimmed;
}

export function normalizeNullish(val: string | undefined): string | null {
  if (val === undefined || val === null) return null;
  const trimmed = val.trim();
  const lower = trimmed.toLowerCase();
  // Handle: 'none', 'NULL', 'null', '\N' (postgres dump artifact), empty string
  if (['none', 'null', '\\n', 'n/a', 'na', ''].includes(lower)) return null;
  if (trimmed === '\\N') return null;
  return trimmed;
}

/**
 * Normalize decimal numbers.
 * Handles European format (comma as decimal separator):
 *   "221,09" → 221.09
 *   "1.420,00" → 1420.00
 * Also handles standard format:
 *   "365.56" → 365.56
 */
export function normalizeDecimal(val: string): number {
  if (!val) return 0;
  const trimmed = val.trim();
  
  // Check if this is European format: has comma and either no dot or dot before comma
  const lastComma = trimmed.lastIndexOf(',');
  const lastDot = trimmed.lastIndexOf('.');
  
  if (lastComma > lastDot) {
    // European format: dots are thousands separators, comma is decimal
    const normalized = trimmed.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  // Standard format or no ambiguity
  const parsed = parseFloat(trimmed.replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

export function mapColumnName(header: string): string {
  const map: Record<string, string> = {
    'Full Name': 'full_name',
    'External Id': 'external_id',
    'Email': 'email',
    'Phone': 'phone',
    'Country': 'country',
    'Status': 'status',
    'City': 'city',
    'Signup At': 'signup_at',
    'Consent Marketing': 'consent_marketing',
    'Brand Code': 'brand_code',
    'Deleted At': 'deleted_at',
    'Suppressed Until': 'suppressed_until',
    'Notes': 'notes',
    'e_mail': 'email',
    'mobile': 'phone',
    'pays': 'country',
  };
  return map[header] || header.toLowerCase().replace(/ /g, '_');
}

export function isValidStatus(val: string): boolean {
  if (!val) return false;
  const lower = val.toLowerCase().trim();
  // Valid statuses
  if (['active', 'bounced', 'unsubscribed', 'unsubscribe', 'pending'].includes(lower)) return true;
  // Detect dates that leaked into status field (ISO 8601 pattern)
  if (/^\d{4}-\d{2}-\d{2}/.test(lower)) return false;
  return false;
}

/**
 * Normalize status values.
 */
export function normalizeStatus(val: string): string {
  if (!val) return 'unknown';
  const trimmed = val.trim().toLowerCase();
  if (trimmed === 'unsubscribe') return 'unsubscribed'; // normalize variant
  if (['active', 'bounced', 'unsubscribed', 'pending'].includes(trimmed)) return trimmed;
  return 'unknown';
}

export function trimAll(val: string | undefined): string {
  if (!val) return '';
  return val.trim();
}
