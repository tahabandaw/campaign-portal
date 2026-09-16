import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If OAuth code is received on any route (e.g. root fallback), forward to auth callback
  if (request.nextUrl.searchParams.has('code') && request.nextUrl.pathname !== '/auth/callback') {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    return NextResponse.redirect(url);
  }

  // Public routes that don't need auth
  const isPublicRoute =
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/auth/callback' ||
    request.nextUrl.pathname.startsWith('/share/') ||
    request.nextUrl.pathname.startsWith('/api/share/') ||
    request.nextUrl.pathname.startsWith('/api/cron/');

  if (!user && !isPublicRoute) {
    // Redirect to login
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === '/login') {
    // Redirect authenticated users away from login
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // For authenticated portal routes, verify user has a brand assignment
  if (user && !isPublicRoute && !request.nextUrl.pathname.startsWith('/api/')) {
    const { data: brandUser } = await supabase
      .from('brand_users')
      .select('id, brand_id, role')
      .eq('user_id', user.id)
      .single();

    if (!brandUser) {
      // User exists in auth but has no brand assignment — deny access
      // Sign them out and redirect to login with error
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
