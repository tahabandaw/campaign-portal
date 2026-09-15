import fs from 'fs';
import path from 'path';

const PROJECT_REF = 'pvwaujpkamfljnqwoihz';
const ACCESS_TOKEN = 'sbp_fc155f6f55d4f69f6b52588fa9ff694edcf8fa99';

async function runQuery(query: string) {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Query failed: ${res.status} ${text}`);
  }

  return res.json();
}

async function main() {
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  const files = ['001_schema.sql', '002_rls_policies.sql', '003_indexes.sql'];

  for (const file of files) {
    console.log(`Applying ${file}...`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    await runQuery(sql);
    console.log(`✅ Applied ${file}`);
  }

  console.log('🎉 All migrations applied successfully!');
}

main().catch(err => {
  console.error('❌ Migration error:', err.message);
  process.exit(1);
});
