import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

/**
 * GET /api/auth/dev-login?email=user@example.com
 *
 * Development-only auth bypass.
 * Creates a dev user and redirects to OTP callback to establish session.
 * BLOCKED in production by middleware.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  if (process.env.DEV_LOGIN_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Dev login not enabled. Set DEV_LOGIN_ENABLED=true in .env.local' }, { status: 403 })
  }

  const url = new URL(request.url)
  const email = url.searchParams.get('email') || process.env.DEV_USER_EMAIL || 'dev@localhost.test'
  const admin = createAdminClient()

  // Try to create user — ignore error if already exists
  const { data: created } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { memberstack_id: 'dev_local', name: 'Dev User' },
  })

  if (created?.user) {
    // New user — create profile record
    await admin.from('profiles').upsert({
      id: created.user.id,
      email,
      first_name: 'Dev',
      last_name: 'User',
      memberstack_id: 'dev_local',
      role: 'admin',
    }, { onConflict: 'id' })
  }

  // Generate magic link — works whether user was just created or already existed
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (linkError || !linkData) {
    console.error('[dev-login] Failed to generate magic link:', linkError)
    return NextResponse.json({ error: 'Failed to generate link' }, { status: 500 })
  }

  const linkUrl = new URL(linkData.properties.action_link)
  const otpToken = linkUrl.searchParams.get('token')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const callbackUrl = new URL('/api/auth/callback', appUrl)
  callbackUrl.searchParams.set('token_hash', otpToken!)
  callbackUrl.searchParams.set('type', 'magiclink')
  callbackUrl.searchParams.set('next', '/')

  return NextResponse.redirect(callbackUrl)
}
