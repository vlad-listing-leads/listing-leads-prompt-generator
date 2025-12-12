import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { generateThumbnail } from '@/lib/thumbnail-service'

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

// Validation schema for updating a customization
const updateCustomizationSchema = z.object({
  name: z.string().min(1).optional(),
  values: z.record(z.string(), z.string()).optional(),
  rendered_html: z.string().optional().nullable(),
  prompt_history: z.array(promptHistoryItemSchema).optional(),
  change_log: z.array(changeLogItemSchema).optional(),
  thumbnail_url: z.string().url().optional().nullable(),
  generate_thumbnail: z.boolean().optional(), // Flag to trigger thumbnail generation
})

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/customizations/[id] - Get a single customization with all details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: customization, error } = await supabase
      .from('customizations')
      .select(`
        *,
        template:listing_templates (
          *,
          listing_template_fields (*)
        ),
        field_values (
          id,
          field_id,
          value
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Customization not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching customization:', error)
      return NextResponse.json(
        { error: 'Failed to fetch customization' },
        { status: 500 }
      )
    }

    // Verify ownership (RLS should handle this, but double-check)
    if (customization.user_id !== user.id) {
      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        return NextResponse.json(
          { error: 'Not authorized to view this customization' },
          { status: 403 }
        )
      }
    }

    // Sort template fields by display_order
    if (customization.template?.listing_template_fields) {
      customization.template.listing_template_fields.sort(
        (a: { display_order: number }, b: { display_order: number }) =>
          a.display_order - b.display_order
      )
    }

    // Transform field_values into a key-value map for easier consumption
    const valuesMap: Record<string, string> = {}
    if (customization.field_values && customization.template?.listing_template_fields) {
      customization.field_values.forEach((fv: { field_id: string; value: string }) => {
        const field = customization.template.listing_template_fields.find(
          (tf: { id: string }) => tf.id === fv.field_id
        )
        if (field) {
          valuesMap[field.field_key] = fv.value || ''
        }
      })
    }

    return NextResponse.json({
      data: {
        ...customization,
        values_map: valuesMap,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/customizations/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/customizations/[id] - Update a customization
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
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
    const validationResult = updateCustomizationSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { name, values, rendered_html, prompt_history, change_log, thumbnail_url, generate_thumbnail } = validationResult.data

    // Fetch existing customization with template fields
    const { data: existingCustomization, error: fetchError } = await supabase
      .from('customizations')
      .select(`
        *,
        template:listing_templates (
          listing_template_fields (
            id,
            field_key
          )
        )
      `)
      .eq('id', id)
      .single()

    if (fetchError || !existingCustomization) {
      return NextResponse.json(
        { error: 'Customization not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (existingCustomization.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to update this customization' },
        { status: 403 }
      )
    }

    // Build update object with provided fields
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (rendered_html !== undefined) updateData.rendered_html = rendered_html
    if (prompt_history !== undefined) updateData.prompt_history = prompt_history
    if (change_log !== undefined) updateData.change_log = change_log
    if (thumbnail_url !== undefined) updateData.thumbnail_url = thumbnail_url

    // Generate thumbnail if requested and we have rendered_html
    if (generate_thumbnail) {
      const htmlToRender = rendered_html || existingCustomization.rendered_html
      if (htmlToRender) {
        try {
          console.log('Generating thumbnail for customization:', id)
          const thumbnailResult = await generateThumbnail(
            htmlToRender,
            name || existingCustomization.name || 'design'
          )
          updateData.thumbnail_url = thumbnailResult.url
          console.log('Thumbnail generated:', thumbnailResult.url)
        } catch (err) {
          console.error('Failed to generate thumbnail:', err)
          // Continue without thumbnail - non-blocking error
        }
      }
    }

    // Update customization if there are fields to update
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('customizations')
        .update(updateData)
        .eq('id', id)

      if (updateError) {
        console.error('Error updating customization:', updateError)
        return NextResponse.json(
          { error: 'Failed to update customization' },
          { status: 500 }
        )
      }
    }

    // Update field values if provided
    if (values !== undefined && existingCustomization.template?.listing_template_fields) {
      // Upsert field values
      for (const [fieldKey, value] of Object.entries(values)) {
        const field = existingCustomization.template.listing_template_fields.find(
          (f: { field_key: string }) => f.field_key === fieldKey
        )

        if (field) {
          // Check if field value exists
          const { data: existingValue } = await supabase
            .from('field_values')
            .select('id')
            .eq('customization_id', id)
            .eq('field_id', field.id)
            .single()

          if (existingValue) {
            // Update existing value
            await supabase
              .from('field_values')
              .update({ value })
              .eq('id', existingValue.id)
          } else {
            // Insert new value
            await supabase
              .from('field_values')
              .insert({
                customization_id: id,
                field_id: field.id,
                value,
              })
          }
        }
      }
    }

    // Fetch updated customization
    const { data: updatedCustomization } = await supabase
      .from('customizations')
      .select(`
        *,
        template:listing_templates (
          *,
          listing_template_fields (*)
        ),
        field_values (
          id,
          field_id,
          value
        )
      `)
      .eq('id', id)
      .single()

    // Transform field_values into a key-value map
    const valuesMap: Record<string, string> = {}
    if (updatedCustomization?.field_values && updatedCustomization?.template?.listing_template_fields) {
      updatedCustomization.field_values.forEach((fv: { field_id: string; value: string }) => {
        const field = updatedCustomization.template.listing_template_fields.find(
          (tf: { id: string }) => tf.id === fv.field_id
        )
        if (field) {
          valuesMap[field.field_key] = fv.value || ''
        }
      })
    }

    return NextResponse.json({
      data: {
        ...updatedCustomization,
        values_map: valuesMap,
      },
    })
  } catch (error) {
    console.error('Error in PUT /api/customizations/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/customizations/[id] - Delete a customization
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify ownership before deletion
    const { data: customization } = await supabase
      .from('customizations')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!customization) {
      return NextResponse.json(
        { error: 'Customization not found' },
        { status: 404 }
      )
    }

    if (customization.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to delete this customization' },
        { status: 403 }
      )
    }

    // Delete customization (cascade will handle field_values)
    const { error } = await supabase
      .from('customizations')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting customization:', error)
      return NextResponse.json(
        { error: 'Failed to delete customization' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Customization deleted successfully' })
  } catch (error) {
    console.error('Error in DELETE /api/customizations/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
