import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Validation schema for template fields
const fieldSchema = z.object({
  id: z.string().optional(), // Allow id field (string, not necessarily UUID for new fields)
  field_key: z.string().min(1, 'Field key is required'),
  field_type: z.enum(['text', 'textarea', 'select', 'image', 'color', 'url', 'email', 'phone']),
  label: z.string().min(1, 'Field label is required'),
  placeholder: z.string().optional().nullable(),
  default_value: z.string().optional().nullable(),
  options: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).optional().nullable(),
  is_required: z.boolean().optional().default(false),
  display_order: z.number().optional().default(0),
})

// Validation schema for updating a template
const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  html_content: z.string().min(1).optional(),
  thumbnail_url: z.string().url().optional().nullable().or(z.literal('')),
  is_active: z.boolean().optional(),
  fields: z.array(fieldSchema).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/templates/[id] - Get a single template with fields
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: template, error } = await supabase
      .from('listing_templates')
      .select(`
        *,
        listing_template_fields (*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching template:', error)
      return NextResponse.json(
        { error: 'Failed to fetch template' },
        { status: 500 }
      )
    }

    // Sort fields by display_order and rename to match expected type
    const templateFields = template.listing_template_fields || []
    templateFields.sort((a: { display_order: number }, b: { display_order: number }) =>
      a.display_order - b.display_order
    )

    // Transform to expected format
    const transformedTemplate = {
      ...template,
      template_fields: templateFields,
    }
    delete transformedTemplate.listing_template_fields

    return NextResponse.json({ data: transformedTemplate })
  } catch (error) {
    console.error('Error in GET /api/templates/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/templates/[id] - Update a template (admin only)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Check if user is authenticated and is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = updateTemplateSchema.safeParse(body)

    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues.map(issue =>
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ')
      return NextResponse.json(
        { error: `Validation failed: ${errorMessages}`, details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { fields, ...templateData } = validationResult.data

    // Check if template exists
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('listing_templates')
      .select('id')
      .eq('id', id)
      .single()

    if (fetchError || !existingTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    // Update template
    const updateData: Record<string, unknown> = {}
    if (templateData.name !== undefined) updateData.name = templateData.name
    if (templateData.description !== undefined) updateData.description = templateData.description
    if (templateData.html_content !== undefined) updateData.html_content = templateData.html_content
    if (templateData.thumbnail_url !== undefined) updateData.thumbnail_url = templateData.thumbnail_url || null
    if (templateData.is_active !== undefined) updateData.is_active = templateData.is_active

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('listing_templates')
        .update(updateData)
        .eq('id', id)

      if (updateError) {
        console.error('Error updating template:', updateError)
        return NextResponse.json(
          { error: 'Failed to update template' },
          { status: 500 }
        )
      }
    }

    // Update fields if provided
    if (fields !== undefined) {
      // Delete existing fields
      await supabase
        .from('listing_template_fields')
        .delete()
        .eq('template_id', id)

      // Insert new fields
      if (fields.length > 0) {
        const fieldsToInsert = fields.map((field, index) => ({
          template_id: id,
          field_key: field.field_key,
          field_type: field.field_type,
          label: field.label,
          placeholder: field.placeholder || null,
          default_value: field.default_value || null,
          options: field.options || null,
          is_required: field.is_required,
          display_order: field.display_order ?? index,
        }))

        const { error: fieldsError } = await supabase
          .from('listing_template_fields')
          .insert(fieldsToInsert)

        if (fieldsError) {
          console.error('Error updating template fields:', fieldsError)
          return NextResponse.json(
            { error: 'Failed to update template fields' },
            { status: 500 }
          )
        }
      }
    }

    // Fetch updated template with fields
    const { data: updatedTemplate } = await supabase
      .from('listing_templates')
      .select(`
        *,
        listing_template_fields (*)
      `)
      .eq('id', id)
      .single()

    // Transform to expected format
    if (updatedTemplate) {
      const fields = updatedTemplate.listing_template_fields || []
      const transformed = {
        ...updatedTemplate,
        template_fields: fields,
      }
      delete transformed.listing_template_fields
      return NextResponse.json({ data: transformed })
    }

    return NextResponse.json({ data: updatedTemplate })
  } catch (error) {
    console.error('Error in PUT /api/templates/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/templates/[id] - Delete a template (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Check if user is authenticated and is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Delete template (cascade will handle fields)
    const { error } = await supabase
      .from('listing_templates')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting template:', error)
      return NextResponse.json(
        { error: 'Failed to delete template' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Template deleted successfully' })
  } catch (error) {
    console.error('Error in DELETE /api/templates/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
