import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Validation schema for creating a template
const fieldSchema = z.object({
  id: z.string().optional(), // Allow id field (ignored for new fields)
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

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  html_content: z.string().min(1, 'HTML content is required'),
  thumbnail_url: z.string().url().optional().or(z.literal('')).nullable(),
  is_active: z.boolean().optional().default(true),
  campaign_id: z.string().uuid().optional().nullable(),
  system_prompt_id: z.string().uuid().optional().nullable(),
  template_prompt: z.string().optional().nullable(),
  artifact_url: z.string().url().optional().or(z.literal('')).nullable(),
  fields: z.array(fieldSchema).optional(),
})

// GET /api/templates - List all templates
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    let query = supabase
      .from('listing_templates')
      .select('*, system_prompt:system_prompts(name)')
      .order('created_at', { ascending: false })

    // Only filter by active status if not including inactive
    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data: templates, error } = await query

    if (error) {
      console.error('Error fetching templates:', error)
      return NextResponse.json(
        { error: 'Failed to fetch templates' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: templates })
  } catch (error) {
    console.error('Error in GET /api/templates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/templates - Create a new template (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated and is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check admin role
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
    const validationResult = createTemplateSchema.safeParse(body)

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

    // Insert template
    const { data: template, error: templateError } = await supabase
      .from('listing_templates')
      .insert({
        name: templateData.name,
        description: templateData.description || null,
        html_content: templateData.html_content,
        thumbnail_url: templateData.thumbnail_url || null,
        is_active: templateData.is_active,
        campaign_id: templateData.campaign_id || null,
        system_prompt_id: templateData.system_prompt_id || null,
        template_prompt: templateData.template_prompt || null,
        artifact_url: templateData.artifact_url || null,
      })
      .select()
      .single()

    if (templateError) {
      console.error('Error creating template:', templateError)
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 }
      )
    }

    // Insert fields if provided
    if (fields && fields.length > 0) {
      const fieldsToInsert = fields.map((field, index) => ({
        template_id: template.id,
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
        console.error('Error creating template fields:', fieldsError)
        // Rollback template creation
        await supabase.from('listing_templates').delete().eq('id', template.id)
        return NextResponse.json(
          { error: 'Failed to create template fields' },
          { status: 500 }
        )
      }
    }

    // Fetch complete template with fields
    const { data: completeTemplate } = await supabase
      .from('listing_templates')
      .select(`
        *,
        listing_template_fields (*)
      `)
      .eq('id', template.id)
      .single()

    return NextResponse.json({ data: completeTemplate }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/templates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
