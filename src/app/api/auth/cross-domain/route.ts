import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const CROSS_APP_AUTH_SECRET = process.env.CROSS_APP_AUTH_SECRET

interface JWTPayload {
  memberstackId: string
  email: string
  timestamp: number
  exp: number
}

function base64UrlDecode(str: string): string {
  // Replace URL-safe characters and add padding
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  return Buffer.from(base64 + padding, 'base64').toString('utf-8')
}

function verifyJWT(token: string): JWTPayload | null {
  if (!CROSS_APP_AUTH_SECRET) {
    console.error('CROSS_APP_AUTH_SECRET is not set')
    return null
  }

  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      console.error('Invalid JWT format: expected 3 parts')
      return null
    }

    const [headerB64, payloadB64, signatureB64] = parts

    // Verify signature (HMAC-SHA256)
    const signatureInput = `${headerB64}.${payloadB64}`
    const expectedSignature = crypto
      .createHmac('sha256', CROSS_APP_AUTH_SECRET)
      .update(signatureInput)
      .digest('base64url')

    if (signatureB64 !== expectedSignature) {
      console.error('JWT signature verification failed')
      return null
    }

    // Decode payload
    const payloadJson = base64UrlDecode(payloadB64)
    const payload = JSON.parse(payloadJson) as JWTPayload

    // Check required fields
    if (!payload.memberstackId || !payload.email || !payload.exp) {
      console.error('JWT payload missing required fields')
      return null
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
      console.error('JWT has expired')
      return null
    }

    return payload
  } catch (error) {
    console.error('JWT verification error:', error)
    return null
  }
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

export async function POST(request: NextRequest) {
  try {
    const { authToken } = await request.json()

    if (!authToken) {
      return NextResponse.json({ error: 'Missing authToken' }, { status: 400 })
    }

    // Verify the JWT
    const payload = verifyJWT(authToken)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const { memberstackId, email } = payload
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
        // Link memberstack_id to existing user
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
          return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
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
      return NextResponse.json({ error: 'Failed to generate session' }, { status: 500 })
    }

    // Extract token from magic link
    const confirmUrl = new URL(linkData.properties.action_link)
    const token = confirmUrl.searchParams.get('token')

    return NextResponse.json({
      success: true,
      token,
      type: 'magiclink',
    })
  } catch (error) {
    console.error('Cross-domain auth error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
