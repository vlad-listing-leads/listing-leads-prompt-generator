import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/** Routes that don't require authentication */
const PUBLIC_ROUTES = [
  '/auth',
  '/api/auth',
  '/api/health',
  '/api/webhooks',
]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Block dev login in production
  if (pathname === '/api/auth/dev-login' && process.env.NODE_ENV === 'production') {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Refresh Supabase session
  const { supabaseResponse, user } = await updateSession(request)

  // Public routes — no auth required
  if (isPublicRoute(pathname)) {
    // Redirect authenticated users away from auth pages (not API)
    if (user && pathname.startsWith('/auth') && !isApiRoute(pathname)) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return supabaseResponse
  }

  // Protected routes — require authentication
  if (!user) {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ success: false, data: null, error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
