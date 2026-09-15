import 'dotenv/config';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import {
  detectDelimiter,
  normalizeBoolean,
  normalizeEmail,
  normalizeNullish,
  normalizeDecimal,
  mapColumnName,
  isValidStatus,
  normalizeStatus,
  normalizeDate,
  trimAll,
} from './normalize';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BRANDS = [
  { code: 'KILELE', name: 'Kilele Rides', country: 'KE', timezone: 'Africa/Nairobi' },
  { code: 'KAROO', name: 'Karoo Coaches', country: 'ZA', timezone: 'Africa/Johannesburg' },
  { code: 'MARRAKECH', name: 'Marrakech Express', country: 'MA', timezone: 'Africa/Casablanca' },
];

interface ImportResult {
  file: string;
  totalRows: number;
  imported: number;
  skipped: number;
  updated: number;
  errors: { row: number; field?: string; value?: string; reason: string }[];
  warnings: { row: number; field?: string; value?: string; reason: string }[];
}

function sanitizeRow(row: Record<string, any>) {
  for (const key of Object.keys(row)) {
    if (typeof row[key] === 'string') {
      let val = row[key].trim();
      if (val === '\\N' || val === '\\n' || val === 'NULL' || val === 'null') {
        row[key] = null;
      } else {
        row[key] = val.replace(/\u0000/g, '').replace(/\\u0000/g, '');
      }
    }
  }
  return row;
}

async function seedBrands() {
  console.log('🏢 Seeding brands...');
  const { data, error } = await supabase
    .from('brands')
    .upsert(BRANDS, { onConflict: 'code', ignoreDuplicates: false })
    .select();

  if (error) {
    console.error('❌ Error seeding brands:', error.message);
    process.exit(1);
  }
  console.log(`   ✅ ${data!.length} brands created/updated`);
  return data!;
}

function readAndParseCsv(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const firstLine = content.split('\n')[0];
  const delimiter = detectDelimiter(firstLine);

  const records = parse(content, {
    columns: (headers: string[]) => headers.map((h: string) => mapColumnName(h.trim())),
    skip_empty_lines: true,
    delimiter,
    trim: true,
    relax_column_count: true,
  });

  return { records, delimiter };
}

function processContactRow(row: Record<string, any>, rowIndex: number, result: ImportResult): Record<string, any> | null {
  delete row.brand_code;
  sanitizeRow(row);

  // Skip duplicate header lines inside CSV
  if (
    row.external_id === 'external_id' ||
    row.full_name === 'full_name' ||
    row.full_name === 'Full Name' ||
    row.email === 'email' ||
    row.email === 'Email'
  ) {
    result.skipped++;
    return null;
  }

  // Handle Karoo misaligned rows where CT- id was parsed into full_name
  if (row.full_name && /^CT-\d+/.test(row.full_name)) {
    const rawExternalId = row.full_name;
    const rawFullName = row.email;
    const rawEmail = row.external_id;
    const rawPhone = row.phone;
    const rawCountry = row.country;
    const rawCity = row.status;
    const rawSignupAt = row.city;
    const rawStatus = row.signup_at;
    const rawConsent = row.consent_marketing;

    row.external_id = rawExternalId;
    row.full_name = rawFullName;
    row.email = rawEmail;
    row.phone = rawPhone;
    row.country = rawCountry;
    row.city = rawCity;
    row.signup_at = rawSignupAt;
    row.status = rawStatus;
    row.consent_marketing = rawConsent;
  }

  const rawEmail = row.email;
  row.email = normalizeEmail(row.email);
  if (rawEmail && rawEmail.includes(' ')) {
    result.warnings.push({ row: rowIndex, field: 'email', value: rawEmail, reason: 'Email contains spaces' });
  }

  row.consent_marketing = normalizeBoolean(row.consent_marketing);
  row.country = normalizeNullish(row.country);

  if (row.status && !isValidStatus(row.status)) {
    result.warnings.push({
      row: rowIndex, field: 'status', value: row.status,
      reason: 'Invalid status (possibly date from column misalignment)',
    });
  }
  row.status = normalizeStatus(row.status || '');

  row.deleted_at = normalizeDate(row.deleted_at);
  row.suppressed_until = normalizeDate(row.suppressed_until);
  row.signup_at = normalizeDate(row.signup_at);

  if (!row.notes || row.notes === '') row.notes = null;

  return row;
}

function processCampaignRow(row: Record<string, any>, delimiter: string) {
  sanitizeRow(row);

  if (row.spend) {
    row.spend = normalizeDecimal(String(row.spend));
  }

  for (const field of ['reported_sent', 'reported_delivered', 'reported_bounced', 'reported_opens', 'reported_clicks']) {
    if (row[field] !== undefined && row[field] !== null) {
      row[field] = parseInt(String(row[field]).replace(/,/g, ''), 10) || 0;
    }
  }

  if (!row.sent_at_utc || row.sent_at_utc === '') row.sent_at_utc = null;
  if (!row.target_country || row.target_country === '') row.target_country = null;
  if (!row.parent_campaign_id || row.parent_campaign_id === '') row.parent_campaign_id = null;
  if (!row.send_local_time || row.send_local_time === '') row.send_local_time = null;

  return row;
}

function processEventRow(row: Record<string, any>) {
  sanitizeRow(row);

  if (row.external_contact_id) {
    row.contact_external_id = row.external_contact_id;
    delete row.external_contact_id;
  }

  if (!row.channel || row.channel === '') row.channel = null;

  return row;
}

function processSendLogRow(row: Record<string, any>, brandId: string, campaignMap: Map<string, string>) {
  sanitizeRow(row);
  const campaignId = campaignMap.get(row.campaign_external_id);
  if (!campaignId) return null;

  return {
    brand_id: brandId,
    batch_key: row.batch_key,
    campaign_id: campaignId,
    idempotency_key: `seed-${row.batch_key}`,
    recipient_count: parseInt(row.recipient_count, 10) || 0,
    status: row.status === 'sent' ? 'sent' : 'pending',
    queued_at: row.queued_at_utc || null,
    sent_at: row.queued_at_utc || null,
  };
}

async function batchUpsert(
  table: string,
  rows: any[],
  onConflict: string,
  result: ImportResult,
  batchSize = 500
) {
  let imported = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    let success = false;
    let lastError: any = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabase
        .from(table)
        .upsert(batch, { onConflict, ignoreDuplicates: false });

      if (!error) {
        imported += batch.length;
        success = true;
        break;
      }
      lastError = error;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }

    if (!success && lastError) {
      result.errors.push({
        row: i,
        reason: `Batch ${Math.floor(i / batchSize)}: ${lastError.message}`,
      });
      console.error(`   ❌ Batch error at row ${i}: ${lastError.message}`);
    }

    if (rows.length > 5000 && (i + batchSize) % 5000 === 0) {
      console.log(`   📊 Progress: ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
    }
  }
  result.imported = imported;
}

async function writeImportLog(result: ImportResult, brandId: string | null) {
  try {
    await supabase.from('import_logs').insert({
      brand_id: brandId,
      file_name: result.file,
      total_rows: result.totalRows,
      rows_imported: result.imported,
      rows_skipped: result.skipped,
      rows_updated: result.updated,
      errors: result.errors.slice(0, 100),
      warnings: result.warnings.slice(0, 100),
      status: 'completed',
    });
  } catch (err) {
    console.error('Error writing import log:', err);
  }
}

async function seedContacts(filePath: string, brandId: string, fileName: string): Promise<ImportResult> {
  const result: ImportResult = { file: fileName, totalRows: 0, imported: 0, skipped: 0, updated: 0, errors: [], warnings: [] };

  if (!fs.existsSync(filePath)) {
    console.log(`   ⏭️  Skipping ${fileName} (not found)`);
    return result;
  }

  console.log(`📇 Processing contacts: ${fileName}...`);
  const { records } = readAndParseCsv(filePath);
  result.totalRows = records.length;

  // Deduplicate on external_id within file so PostgreSQL doesn't fail on concurrent conflict update
  const dedupMap = new Map<string, any>();
  records.forEach((record: any, i: number) => {
    const row = processContactRow({ ...record }, i + 2, result);
    if (!row) return;
    row.brand_id = brandId;
    if (dedupMap.has(row.external_id)) {
      result.skipped++;
      result.warnings.push({ row: i + 2, field: 'external_id', value: row.external_id, reason: 'Duplicate external_id in file, latest kept' });
    }
    dedupMap.set(row.external_id, row);
  });

  const uniqueRows = Array.from(dedupMap.values());
  await batchUpsert('contacts', uniqueRows, 'brand_id,external_id', result);
  console.log(`   ✅ ${result.imported}/${result.totalRows} contacts processed (${result.skipped} deduplicated, ${result.warnings.length} warnings)`);

  return result;
}

async function seedCampaigns(filePath: string, brandId: string, fileName: string): Promise<ImportResult> {
  const result: ImportResult = { file: fileName, totalRows: 0, imported: 0, skipped: 0, updated: 0, errors: [], warnings: [] };

  if (!fs.existsSync(filePath)) {
    console.log(`   ⏭️  Skipping ${fileName} (not found)`);
    return result;
  }

  console.log(`📣 Processing campaigns: ${fileName}...`);
  const { records, delimiter } = readAndParseCsv(filePath);
  result.totalRows = records.length;

  const dedupMap = new Map<string, any>();
  records.forEach((record: any) => {
    const row = processCampaignRow({ ...record }, delimiter);
    row.brand_id = brandId;
    if (dedupMap.has(row.external_id)) {
      result.skipped++;
      result.warnings.push({ row: 0, field: 'external_id', value: row.external_id, reason: 'Duplicate campaign external_id in file' });
    }
    dedupMap.set(row.external_id, row);
  });

  const uniqueRows = Array.from(dedupMap.values());
  await batchUpsert('campaigns', uniqueRows, 'brand_id,external_id', result);
  console.log(`   ✅ ${result.imported}/${result.totalRows} campaigns processed (${result.skipped} deduplicated)`);

  return result;
}

async function seedEvents(filePath: string, brandId: string, fileName: string): Promise<ImportResult> {
  const result: ImportResult = { file: fileName, totalRows: 0, imported: 0, skipped: 0, updated: 0, errors: [], warnings: [] };

  if (!fs.existsSync(filePath)) {
    console.log(`   ⏭️  Skipping ${fileName} (not found)`);
    return result;
  }

  console.log(`📊 Processing events: ${fileName}...`);
  const { records } = readAndParseCsv(filePath);
  result.totalRows = records.length;

  const dedupMap = new Map<string, any>();
  records.forEach((record: any) => {
    const row = processEventRow({ ...record });
    row.brand_id = brandId;
    if (dedupMap.has(row.event_id)) {
      result.skipped++;
    }
    dedupMap.set(row.event_id, row);
  });

  const uniqueRows = Array.from(dedupMap.values());
  await batchUpsert('events', uniqueRows, 'brand_id,event_id', result, 1000);
  console.log(`   ✅ ${result.imported}/${result.totalRows} events processed (${result.skipped} deduplicated)`);

  return result;
}

async function seedSendLog(filePath: string, brandId: string, fileName: string): Promise<ImportResult> {
  const result: ImportResult = { file: fileName, totalRows: 0, imported: 0, skipped: 0, updated: 0, errors: [], warnings: [] };

  if (!fs.existsSync(filePath)) {
    console.log(`   ⏭️  Skipping ${fileName} (not found)`);
    return result;
  }

  console.log(`📨 Processing send log: ${fileName}...`);
  const { records } = readAndParseCsv(filePath);
  result.totalRows = records.length;

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, external_id')
    .eq('brand_id', brandId);

  const campaignMap = new Map((campaigns || []).map((c: any) => [c.external_id, c.id]));

  const seen = new Set<string>();
  const rows: any[] = [];

  for (const record of (records as Array<Record<string, any>>)) {
    if (seen.has(record.batch_key)) {
      result.skipped++;
      result.warnings.push({ row: rows.length, field: 'batch_key', value: record.batch_key, reason: 'Duplicate batch_key' });
      continue;
    }
    seen.add(record.batch_key);

    const row = processSendLogRow(record, brandId, campaignMap);
    if (row) {
      rows.push(row);
    } else {
      result.skipped++;
      result.warnings.push({ row: rows.length, field: 'campaign_external_id', value: record.campaign_external_id, reason: 'Campaign not found' });
    }
  }

  await batchUpsert('send_batches', rows, 'idempotency_key', result);
  console.log(`   ✅ ${result.imported}/${result.totalRows} send log entries imported (${result.skipped} skipped)`);

  return result;
}

async function main() {
  console.log('🚀 Starting data seed...\n');

  const brands = await seedBrands();
  const brandMap = new Map(brands.map((b: any) => [b.code, b]));
  console.log('');

  const allResults: ImportResult[] = [];
  const dataDir = path.join(process.cwd(), 'data');

  // Seed contacts
  for (const { file, brand } of [
    { file: 'kilele-contacts.csv', brand: 'KILELE' },
    { file: 'karoo-contacts.csv', brand: 'KAROO' },
    { file: 'marrakech-contacts.csv', brand: 'MARRAKECH' },
  ]) {
    const brandInfo = brandMap.get(brand)!;
    const result = await seedContacts(path.join(dataDir, file), brandInfo.id, file);
    allResults.push(result);
    await writeImportLog(result, brandInfo.id);
  }

  // Delta file
  console.log('\n📇 Processing delta file (updates + new contacts)...');
  const kilele = brandMap.get('KILELE')!;
  const deltaResult = await seedContacts(
    path.join(dataDir, 'kilele-contacts-delta-2026-09-01.csv'),
    kilele.id,
    'kilele-contacts-delta-2026-09-01.csv'
  );
  allResults.push(deltaResult);
  await writeImportLog(deltaResult, kilele.id);

  console.log('');

  // Seed campaigns
  for (const { file, brand } of [
    { file: 'kilele-campaigns.csv', brand: 'KILELE' },
    { file: 'karoo-campaigns.csv', brand: 'KAROO' },
    { file: 'marrakech-campaigns.csv', brand: 'MARRAKECH' },
  ]) {
    const brandInfo = brandMap.get(brand)!;
    const result = await seedCampaigns(path.join(dataDir, file), brandInfo.id, file);
    allResults.push(result);
    await writeImportLog(result, brandInfo.id);
  }

  console.log('');

  // Seed events
  for (const { file, brand } of [
    { file: 'kilele-events.csv', brand: 'KILELE' },
    { file: 'karoo-events.csv', brand: 'KAROO' },
    { file: 'marrakech-events.csv', brand: 'MARRAKECH' },
  ]) {
    const brandInfo = brandMap.get(brand)!;
    const result = await seedEvents(path.join(dataDir, file), brandInfo.id, file);
    allResults.push(result);
    await writeImportLog(result, brandInfo.id);
  }

  console.log('');

  // Seed send log
  const sendLogResult = await seedSendLog(
    path.join(dataDir, 'kilele-send-log.csv'),
    kilele.id,
    'kilele-send-log.csv'
  );
  allResults.push(sendLogResult);
  await writeImportLog(sendLogResult, kilele.id);

  console.log('\n' + '='.repeat(60));
  console.log('📋 SEED SUMMARY');
  console.log('='.repeat(60));
  for (const r of allResults) {
    const status = r.errors.length === 0 ? '✅' : '⚠️';
    console.log(`${status} ${r.file}: ${r.imported}/${r.totalRows} imported, ${r.skipped} skipped, ${r.errors.length} errors, ${r.warnings.length} warnings`);
  }
  console.log('='.repeat(60));
  console.log('🎉 Seed complete!');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
