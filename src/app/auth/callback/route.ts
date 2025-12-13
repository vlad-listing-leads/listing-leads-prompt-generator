import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Shared secret for verifying tokens from the main site
const AUTH_SECRET = process.env.MEMBERSTACK_AUTH_SECRET || 'dev-secret-change-in-production'

function verifyToken(memberstackId: string, email: string, timestamp: string, token: string): boolean {
  // In development, allow a simple test token
  if (process.env.NODE_ENV === 'development' && token === 'dev-test') {
    return true
  }

  // Verify the token is a valid HMAC of the data
  const data = `${memberstackId}:${email}:${timestamp}`
  const expectedToken = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('hex')

  if (token !== expectedToken) {
    return false
  }

  // Check timestamp is within 5 minutes
  const ts = parseInt(timestamp, 10)
  const now = Date.now()
  if (isNaN(ts) || Math.abs(now - ts) > 5 * 60 * 1000) {
    return false
  }

  return true
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const memberstackId = searchParams.get('memberstackId')
  const email = searchParams.get('email')
  const timestamp = searchParams.get('t')
  const token = searchParams.get('token')
  const redirectTo = searchParams.get('redirect') || '/designs'

  if (!memberstackId || !email || !timestamp || !token) {
    return NextResponse.redirect(new URL('/login?error=missing_params', request.url))
  }

  if (!verifyToken(memberstackId, email, timestamp, token)) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', request.url))
  }

  try {
    const supabaseAdmin = createAdminClient()

    // Check if user exists by memberstack_id in profiles
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('memberstack_id', memberstackId)
      .single()

    let userEmail = email

    if (existingProfile) {
      // User exists with this memberstack_id, get their email from auth
      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(existingProfile.id)
      if (user?.email) {
        userEmail = user.email
      }
    } else {
      // Check if user exists by email in auth.users
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = users.find(u => u.email === email)

      if (existingUser) {
        // Link memberstack_id to existing user - upsert to handle missing profile
        await supabaseAdmin
          .from('profiles')
          .upsert({
            id: existingUser.id,
            email: email,
            memberstack_id: memberstackId,
          }, { onConflict: 'id' })
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { memberstack_id: memberstackId },
        })

        if (createError || !newUser.user) {
          console.error('Error creating user:', createError)
          return NextResponse.redirect(new URL('/login?error=create_failed', request.url))
        }

        // Create profile with memberstack_id
        await supabaseAdmin
          .from('profiles')
          .upsert({
            id: newUser.user.id,
            email: email,
            memberstack_id: memberstackId,
          }, { onConflict: 'id' })
      }
    }

    // Generate magic link to create session
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
    })

    if (linkError || !linkData) {
      console.error('Error generating link:', linkError)
      return NextResponse.redirect(new URL('/login?error=link_failed', request.url))
    }

    // Redirect to Supabase's confirm endpoint
    const confirmUrl = new URL(linkData.properties.action_link)
    confirmUrl.searchParams.set('redirect_to', new URL(redirectTo, request.url).toString())

    return NextResponse.redirect(confirmUrl.toString())
  } catch (error) {
    console.error('Auth callback error:', error)
    return NextResponse.redirect(new URL('/login?error=server_error', request.url))
  }
}
