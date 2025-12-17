import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  description: z.string().optional().nullable(),
  color: z.string().optional().default('#f5d5d5'),
})

// GET - List all campaigns (admins see all, users see their own)
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    // Build query - admins see all, users see their own (RLS also enforces this)
    let query = supabase
      .from('campaigns')
      .select(`
        *,
        templates:listing_templates(count)
      `)

    // Only filter by user_id for non-admins
    if (!isAdmin) {
      query = query.eq('user_id', user.id)
    }

    const { data: campaigns, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching campaigns:', error)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    // Transform count from array to number
    const transformedCampaigns = campaigns?.map(campaign => ({
      ...campaign,
      template_count: campaign.templates?.[0]?.count || 0,
      templates: undefined,
    }))

    return NextResponse.json({ data: transformedCampaigns })
  } catch (error) {
    console.error('Error in campaigns GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new campaign
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = campaignSchema.parse(body)

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        name: validatedData.name,
        description: validatedData.description || null,
        color: validatedData.color,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating campaign:', error)
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
    }

    return NextResponse.json({ data: campaign }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Error in campaigns POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
