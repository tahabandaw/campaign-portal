import 'dotenv/config';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const USERS = [
  { email: 'kilele.owner@vg-eval.test', password: 'KileleOwner123!', brand: 'KILELE', role: 'owner' },
  { email: 'kilele.analyst@vg-eval.test', password: 'KileleAnalyst123!', brand: 'KILELE', role: 'analyst' },
  { email: 'karoo.owner@vg-eval.test', password: 'KarooOwner123!', brand: 'KAROO', role: 'owner' },
  { email: 'karoo.analyst@vg-eval.test', password: 'KarooAnalyst123!', brand: 'KAROO', role: 'analyst' },
  { email: 'marrakech.owner@vg-eval.test', password: 'MarrakechOwner123!', brand: 'MARRAKECH', role: 'owner' },
  { email: 'marrakech.analyst@vg-eval.test', password: 'MarrakechAnalyst123!', brand: 'MARRAKECH', role: 'analyst' }
];

async function main() {
  console.log('Fetching brands...');
  const { data: brands, error: brandsError } = await supabase.from('brands').select('id, code');
  
  if (brandsError || !brands) {
    console.error('Failed to fetch brands', brandsError);
    process.exit(1);
  }

  const brandMap = new Map(brands.map(b => [b.code, b.id]));

  for (const user of USERS) {
    console.log(`Creating user: ${user.email}`);
    
    // Create user in Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true
    });

    let userId = authData?.user?.id;

    if (authError) {
      if (authError.message.includes('already exists')) {
        console.log(`User ${user.email} already exists. Fetching id...`);
        // We'd need to find the user id if they exist, to map them.
        // For simplicity in this script, we can query auth.users if we have permissions or just skip.
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existing = existingUsers?.users.find(u => u.email === user.email);
        if (existing) {
          userId = existing.id;
        } else {
           console.error(`Could not fetch existing user ID for ${user.email}`);
           continue;
        }
      } else {
        console.error(`Failed to create user ${user.email}:`, authError.message);
        continue;
      }
    }

    const brandId = brandMap.get(user.brand);
    if (!brandId || !userId) {
      console.warn(`Could not resolve brand/user for ${user.email}`);
      continue;
    }

    // Map to brand
    const { error: mapError } = await supabase
      .from('brand_users')
      .upsert({
        user_id: userId,
        brand_id: brandId,
        role: user.role
      }, { onConflict: 'user_id,brand_id' });

    if (mapError) {
      console.error(`Failed to map user ${user.email} to brand ${user.brand}:`, mapError.message);
    } else {
      console.log(`Successfully mapped ${user.email} to ${user.brand} as ${user.role}`);
    }
  }

  console.log('User creation and mapping complete.');
}

main().catch(console.error);
