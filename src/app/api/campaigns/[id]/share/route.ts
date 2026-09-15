import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateToken } from '@/lib/utils';
import bcrypt from 'bcryptjs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('brand_id')
      .eq('id', id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const { data: brandUser, error: roleError } = await supabase
      .from('brand_users')
      .select('role')
      .eq('brand_id', campaign.brand_id)
      .eq('user_id', user.id)
      .single();

    if (roleError || !brandUser || brandUser.role !== 'owner') {
      return NextResponse.json({ error: 'Must be brand owner to share campaign' }, { status: 403 });
    }

    const token = generateToken(32);
    const hash = await bcrypt.hash(password, 10);

    const { error: insertError } = await supabase
      .from('campaign_shares')
      .insert({
        campaign_id: id,
        brand_id: campaign.brand_id,
        token,
        password_hash: hash,
        created_by: user.id
      });

    if (insertError) {
      return NextResponse.json({ error: 'Failed to create share' }, { status: 500 });
    }

    const origin = new URL(request.url).origin;

    return NextResponse.json({
      url: `${origin}/share/${token}`,
      token
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
