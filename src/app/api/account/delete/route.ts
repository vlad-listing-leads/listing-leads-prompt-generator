import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function DELETE() {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = user.id

    // Delete user's data in order (respecting foreign key constraints)

    // 1. Delete customizations
    const { error: customizationsError } = await supabase
      .from('customizations')
      .delete()
      .eq('user_id', userId)

    if (customizationsError) {
      console.error('Error deleting customizations:', customizationsError)
    }

    // 2. Delete profile field values
    const { error: profileValuesError } = await supabase
      .from('profile_field_values')
      .delete()
      .eq('user_id', userId)

    if (profileValuesError) {
      console.error('Error deleting profile values:', profileValuesError)
    }

    // 3. Delete profile
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      console.error('Error deleting profile:', profileError)
    }

    // 4. Delete the auth user using service role client
    const serviceClient = await createServiceClient()
    const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(userId)

    if (deleteUserError) {
      console.error('Error deleting auth user:', deleteUserError)
      return NextResponse.json(
        { error: 'Failed to delete account. Please try again or contact support.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
