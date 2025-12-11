import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Validation schema for prompt history and change log items
const promptHistoryItemSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  timestamp: z.string(),
  type: z.enum(['user', 'system']),
})

const changeLogItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  timestamp: z.string(),
})

// Validation schema for creating a customization
const createCustomizationSchema = z.object({
  template_id: z.string().uuid('Invalid template ID'),
  name: z.string().min(1, 'Name is required'),
  values: z.record(z.string(), z.string()).optional().default({}),
  rendered_html: z.string().optional().nullable(),
  prompt_history: z.array(promptHistoryItemSchema).optional().default([]),
  change_log: z.array(changeLogItemSchema).optional().default([]),
})

// GET /api/customizations - List user's customizations
export async function GET() {
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

    const { data: customizations, error } = await supabase
      .from('customizations')
      .select(`
        *,
        template:listing_templates (
          id,
          name,
          thumbnail_url,
          campaign_id
        )
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching customizations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch customizations' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: customizations })
  } catch (error) {
    console.error('Error in GET /api/customizations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/customizations - Create a new customization
export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json()
    const validationResult = createCustomizationSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { template_id, name, values, rendered_html, prompt_history, change_log } = validationResult.data

    // Verify template exists and is active
    const { data: template, error: templateError } = await supabase
      .from('listing_templates')
      .select(`
        id,
        is_active,
        listing_template_fields (
          id,
          field_key
        )
      `)
      .eq('id', template_id)
      .single()

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    if (!template.is_active) {
      return NextResponse.json(
        { error: 'Template is not available' },
        { status: 400 }
      )
    }

    // Create customization
    const { data: customization, error: customizationError } = await supabase
      .from('customizations')
      .insert({
        user_id: user.id,
        template_id,
        name,
        status: 'draft',
        rendered_html: rendered_html || null,
        prompt_history: prompt_history || [],
        change_log: change_log || [],
      })
      .select()
      .single()

    if (customizationError) {
      console.error('Error creating customization:', customizationError)
      return NextResponse.json(
        { error: 'Failed to create customization' },
        { status: 500 }
      )
    }

    // Create field values if provided
    if (Object.keys(values).length > 0 && template.listing_template_fields) {
      const fieldValueEntries = Object.entries(values)
        .map(([fieldKey, value]) => {
          const field = template.listing_template_fields.find(
            (f: { field_key: string }) => f.field_key === fieldKey
          )
          if (field) {
            return {
              customization_id: customization.id,
              field_id: field.id,
              value,
            }
          }
          return null
        })
        .filter(Boolean)

      if (fieldValueEntries.length > 0) {
        const { error: valuesError } = await supabase
          .from('field_values')
          .insert(fieldValueEntries)

        if (valuesError) {
          console.error('Error creating field values:', valuesError)
          // Don't fail the whole request, customization is still created
        }
      }
    }

    // Fetch complete customization
    const { data: completeCustomization } = await supabase
      .from('customizations')
      .select(`
        *,
        template:listing_templates (
          id,
          name,
          thumbnail_url
        ),
        field_values (
          id,
          field_id,
          value,
          template_field:listing_template_fields (
            id,
            field_key,
            field_type,
            label
          )
        )
      `)
      .eq('id', customization.id)
      .single()

    return NextResponse.json({ data: completeCustomization }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/customizations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
