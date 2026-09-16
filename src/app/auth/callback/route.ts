import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && sessionData?.user) {
      const user = sessionData.user
      try {
        const admin = createAdminClient()
        // Check if user already has an entry in brand_users
        const { data: brandUser } = await admin
          .from('brand_users')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!brandUser) {
          // If no brand_users mapping exists, determine brand from email or default to Kilele
          const email = (user.email || '').toLowerCase()
          let brandCode = 'KILELE'
          let role = 'owner'

          if (email.includes('karoo')) brandCode = 'KAROO'
          if (email.includes('marrakech')) brandCode = 'MARRAKECH'
          if (email.includes('analyst')) role = 'analyst'

          const { data: brand } = await admin
            .from('brands')
            .select('id')
            .eq('code', brandCode)
            .single()

          if (brand) {
            await admin.from('brand_users').insert({
              user_id: user.id,
              brand_id: brand.id,
              role,
            })
          }
        }
      } catch (provisionErr) {
        console.error('Error auto-provisioning brand_users for OAuth user:', provisionErr)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=unauthorized`)
}
