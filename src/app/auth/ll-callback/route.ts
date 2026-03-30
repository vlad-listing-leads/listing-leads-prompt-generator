import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { jwtVerify } from 'jose'
import { createClient } from '@supabase/supabase-js'

interface CrossAppTokenPayload {
  memberstackId: string
  email: string
  role: string
  name?: string
  timestamp: number
}

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
 * GET /auth/ll-callback?token=JWT
 *
 * Listing Leads cross-app SSO callback.
 * Validates JWT, creates/links user, establishes Supabase session.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const token = searchParams.get('token')

  if (!token) {
    console.warn('[ll-callback] missing token')
    return NextResponse.redirect(new URL('/auth/login?error=missing_token', origin))
  }

  const secret = process.env.CROSS_APP_AUTH_SECRET
  if (!secret) {
    console.error('[ll-callback] CROSS_APP_AUTH_SECRET not configured')
    return NextResponse.json({ error: 'CROSS_APP_AUTH_SECRET not set' }, { status: 500 })
  }

  // 1. Call satellite verify FIRST (JWT expires in 60s, must be first network call)
  let activePlanIds: string[] = []
  let isTeamMember = false
  try {
    const verifyRes = await fetch('https://www.listingleads.com/api/auth/satellite/verify', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (verifyRes.ok) {
      const { user: verifiedUser } = await verifyRes.json()
      activePlanIds = verifiedUser.activePlanIds ?? []
      isTeamMember = verifiedUser.isTeamMember ?? false
    } else {
      console.warn('[ll-callback] satellite verify failed (non-fatal), status:', verifyRes.status)
    }
  } catch (err) {
    console.warn('[ll-callback] satellite verify error (non-fatal):', String(err))
  }

  // 2. Validate JWT locally
  let payload: CrossAppTokenPayload
  try {
    const result = await jwtVerify(token, new TextEncoder().encode(secret))
    payload = result.payload as unknown as CrossAppTokenPayload
  } catch (err) {
    console.warn('[ll-callback] invalid or expired token:', err)
    return NextResponse.json(
      { error: 'JWT verification failed', details: String(err) },
      { status: 401 }
    )
  }

  const { memberstackId, email, name } = payload
  if (!memberstackId || !email) {
    return NextResponse.json(
      { error: 'JWT missing required fields' },
      { status: 400 }
    )
  }

  const displayName = name || email.split('@')[0]
  const admin = createAdminClient()

  // 3. Create or find Supabase Auth user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { memberstack_id: memberstackId },
  })

  if (created?.user) {
    // New user — create profile
    console.info('[ll-callback] created new auth user:', email)
    await admin
      .from('profiles')
      .upsert({
        id: created.user.id,
        email,
        first_name: displayName,
        memberstack_id: memberstackId,
        active_plan_ids: activePlanIds,
        is_team_member: isTeamMember,
      }, { onConflict: 'id' })
  } else {
    // User exists — sync memberstack_id + plan data
    if (createErr) {
      console.info('[ll-callback] auth user exists, syncing:', email)
    }

    // Find existing profile by memberstack_id first, then by email
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('memberstack_id', memberstackId)
      .single()

    if (existingProfile) {
      // Profile exists — sync plan data
      await admin
        .from('profiles')
        .update({
          active_plan_ids: activePlanIds,
          is_team_member: isTeamMember,
        })
        .eq('id', existingProfile.id)
    } else {
      // Try to find by email in auth users
      const { data: { users } } = await admin.auth.admin.listUsers()
      const existingUser = users.find(u => u.email === email)

      if (existingUser) {
        await admin
          .from('profiles')
          .upsert({
            id: existingUser.id,
            email,
            memberstack_id: memberstackId,
            active_plan_ids: activePlanIds,
            is_team_member: isTeamMember,
          }, { onConflict: 'id' })
      }
    }
  }

  // 4. Generate magic link OTP
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (linkError || !linkData) {
    console.error('[ll-callback] failed to generate magic link:', linkError)
    return NextResponse.json(
      { error: 'Failed to generate magic link' },
      { status: 500 }
    )
  }

  const emailOtp = linkData.properties?.email_otp
  if (!emailOtp) {
    console.error('[ll-callback] no email_otp in generateLink response')
    return NextResponse.json({ error: 'No email_otp in magic link response' }, { status: 500 })
  }

  // 5. Verify OTP — set session cookies on the redirect response
  const response = NextResponse.redirect(new URL('/', origin))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name: n, value, options }) => {
            response.cookies.set(n, value, options)
          })
        },
      },
    }
  )

  const { error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token: emailOtp,
    type: 'magiclink',
  })

  if (verifyError) {
    console.error('[ll-callback] OTP verification failed:', verifyError.message)
    return NextResponse.json(
      { error: 'OTP verification failed', details: verifyError.message },
      { status: 500 }
    )
  }

  console.info('[ll-callback] session established for:', email)
  return response
}
