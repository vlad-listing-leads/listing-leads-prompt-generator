import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create admin client for user management (not using cookies)
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
    const { memberstackId, email, firstName, lastName } = await request.json()

    if (!memberstackId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: memberstackId and email' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminClient()

    // First, check if a user with this memberstack_id already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('memberstack_id', memberstackId)
      .single()

    let userId: string

    if (existingProfile) {
      // User exists, use their ID
      userId = existingProfile.id
    } else {
      // Check if a user with this email exists in auth.users
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
      const existingAuthUser = users.find(u => u.email === email)

      if (existingAuthUser) {
        // Link existing account to Memberstack
        userId = existingAuthUser.id
        await supabaseAdmin
          .from('profiles')
          .upsert({
            id: userId,
            email: email,
            memberstack_id: memberstackId,
            first_name: firstName || null,
            last_name: lastName || null,
          }, { onConflict: 'id' })
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true, // Skip email verification for MS users
          user_metadata: {
            memberstack_id: memberstackId,
            first_name: firstName || '',
            last_name: lastName || '',
          },
        })

        if (createError) {
          console.error('Error creating user:', createError)
          return NextResponse.json(
            { error: 'Failed to create user account' },
            { status: 500 }
          )
        }

        userId = newUser.user.id

        // Create profile with memberstack_id and names
        await supabaseAdmin
          .from('profiles')
          .upsert({
            id: userId,
            email: email,
            memberstack_id: memberstackId,
            first_name: firstName || null,
            last_name: lastName || null,
          }, { onConflict: 'id' })
      }
    }

    // Generate a magic link for the user to sign in
    // We'll use the token from this to create a session
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    if (linkError || !linkData) {
      console.error('Error generating link:', linkError)
      return NextResponse.json(
        { error: 'Failed to generate authentication link' },
        { status: 500 }
      )
    }

    // Extract the token from the magic link
    const url = new URL(linkData.properties.action_link)
    const token = url.searchParams.get('token')
    const type = url.searchParams.get('type')

    if (!token) {
      return NextResponse.json(
        { error: 'Failed to extract authentication token' },
        { status: 500 }
      )
    }

    // Return the token info for the frontend to verify
    return NextResponse.json({
      success: true,
      token,
      type,
      email,
    })
  } catch (error) {
    console.error('Memberstack auth error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
