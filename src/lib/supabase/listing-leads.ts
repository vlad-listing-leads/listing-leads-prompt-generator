import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * READ-ONLY Supabase client for Listing Leads database.
 * Used to fetch user profile data from the hub app.
 *
 * CRITICAL: This client intentionally should never write to LL's database.
 */
export function createListingLeadsClient(): SupabaseClient {
  const url = process.env.LISTING_LEADS_SUPABASE_URL
  const key = process.env.LISTING_LEADS_SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing LISTING_LEADS_SUPABASE_URL or LISTING_LEADS_SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Fetch a user's profile from Listing Leads by memberstack_id.
 * Returns profile data + custom field values.
 */
export async function getListingLeadsProfile(memberstackId: string) {
  try {
    const client = createListingLeadsClient()

    // Get core profile
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('*')
      .eq('memberstack_id', memberstackId)
      .single()

    if (profileError || !profile) {
      console.warn('[ll-profile] LL profile not found for', memberstackId)
      return null
    }

    // Get custom field values
    const { data: fieldValues } = await client
      .from('profile_values')
      .select('field_id, value, profile_fields!inner(field_key)')
      .eq('user_id', profile.id)

    // Flatten into key-value map
    const fields: Record<string, string> = {}
    if (fieldValues) {
      for (const fv of fieldValues) {
        const fieldKey = (fv as Record<string, unknown>).profile_fields as { field_key: string }
        if (fieldKey?.field_key) {
          fields[fieldKey.field_key] = fv.value
        }
      }
    }

    return {
      id: profile.id,
      email: profile.email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      memberstackId: profile.memberstack_id,
      role: profile.role,
      region: profile.region,
      fields,
    }
  } catch (error) {
    console.error('[ll-profile] Failed to fetch LL profile:', error)
    return null
  }
}
