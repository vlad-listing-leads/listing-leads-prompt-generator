import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const fetchAll = searchParams.get('all') === 'true'
    const key = searchParams.get('key')

    // Check if user is admin for admin-only settings
    const { data: { user } } = await supabase.auth.getUser()

    // For public settings like campaign_sort_order, allow any authenticated user
    const isPublicSetting = key === 'campaign_sort_order'

    if (!user && !isPublicSetting) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isPublicSetting && user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Fetch all settings or a specific one
    if (fetchAll) {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')

      if (error) throw error
      return NextResponse.json({ data: data || [] })
    }

    // Get specific setting by key
    const settingKey = key || 'ai_provider'
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('key', settingKey)
      .maybeSingle()

    if (error) throw error

    // Return default values if setting doesn't exist
    const defaults: Record<string, unknown> = {
      ai_provider: { key: 'ai_provider', value: { provider: 'anthropic' } },
      campaign_sort_order: { key: 'campaign_sort_order', value: { sort_order: 'created_at_desc' } }
    }

    return NextResponse.json({
      data: data || defaults[settingKey] || null
    })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
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

    const { key, value } = await request.json()

    if (!key || !value) {
      return NextResponse.json({ error: 'Key and value are required' }, { status: 400 })
    }

    // Upsert the setting
    const { data, error } = await supabase
      .from('app_settings')
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error saving settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
