import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const MEMBERSTACK_LOGIN_URL = process.env.NEXT_PUBLIC_MEMBERSTACK_LOGIN_URL || 'https://listingleads.com/login'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Skip auth check for Memberstack auth endpoint
  if (request.nextUrl.pathname.startsWith('/api/auth/memberstack')) {
    return supabaseResponse
  }

  // Admin routes - still require Supabase auth + admin role
  const adminPaths = ['/admin']
  const isAdminPath = adminPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Check admin access - admin routes still need explicit protection
  if (isAdminPath) {
    if (!user) {
      // For admin routes, redirect to Memberstack login if not authenticated
      const loginUrl = new URL(MEMBERSTACK_LOGIN_URL)
      loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/designs'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
