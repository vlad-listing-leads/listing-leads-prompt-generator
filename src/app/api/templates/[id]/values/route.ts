import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/templates/[id]/values - Get user's saved values for a template
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: templateId } = await params
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's saved values for this template
    // Use maybeSingle() instead of single() to return null when no rows exist (instead of 406 error)
    const { data, error } = await supabase
      .from('user_template_values')
      .select('values')
      .eq('user_id', user.id)
      .eq('template_id', templateId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching user template values:', error)
      return NextResponse.json({ error: 'Failed to fetch values' }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        values: data?.values || {},
      },
    })
  } catch (error) {
    console.error('Error in GET /api/templates/[id]/values:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Validation schema
const updateValuesSchema = z.object({
  values: z.record(z.string(), z.string()),
})

// PUT /api/templates/[id]/values - Save user's values for a template
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: templateId } = await params
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = updateValuesSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { values } = validationResult.data

    // Upsert the values (insert or update)
    const { error } = await supabase.from('user_template_values').upsert(
      {
        user_id: user.id,
        template_id: templateId,
        values,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,template_id',
      }
    )

    if (error) {
      console.error('Error saving user template values:', error)
      return NextResponse.json({ error: 'Failed to save values' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Values saved successfully' })
  } catch (error) {
    console.error('Error in PUT /api/templates/[id]/values:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
