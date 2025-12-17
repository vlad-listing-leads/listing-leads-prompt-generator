import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST - Update template display order
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check if user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { templateIds } = await request.json()

    if (!Array.isArray(templateIds) || templateIds.length === 0) {
      return NextResponse.json({ error: 'templateIds array is required' }, { status: 400 })
    }

    // Update each template's display_order based on its position in the array
    const updates = templateIds.map((id: string, index: number) =>
      supabase
        .from('listing_templates')
        .update({ display_order: index + 1 })
        .eq('id', id)
    )

    const results = await Promise.all(updates)

    // Check for any errors
    const errors = results.filter(r => r.error)
    if (errors.length > 0) {
      console.error('Error updating template order:', errors[0].error)
      return NextResponse.json({ error: 'Failed to update template order' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in templates reorder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
