import { apiSuccess, apiError } from '@/lib/api/response'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getListingLeadsProfile } from '@/lib/supabase/listing-leads'

/**
 * POST /api/user/sync-profile
 * Syncs the current user's profile fields from Listing Leads into local profile_values.
 * Called on window focus so edits on LL are picked up without re-login.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return apiError('Unauthorized', 401)
    }

    const admin = await createServiceClient()

    const { data: profile } = await admin
      .from('profiles')
      .select('id, memberstack_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.memberstack_id) {
      return apiError('No Listing Leads account linked', 404)
    }

    const llProfile = await getListingLeadsProfile(profile.memberstack_id)
    if (!llProfile) {
      return apiError('Listing Leads profile not found', 404)
    }

    // Get profile_fields definitions
    const { data: profileFields } = await admin
      .from('profile_fields')
      .select('id, field_key')

    if (profileFields?.length) {
      const fieldKeyToId: Record<string, string> = {}
      for (const f of profileFields) {
        fieldKeyToId[f.field_key] = f.id
      }

      // Sync LL fields into local profile_values
      for (const [fieldKey, value] of Object.entries(llProfile.fields)) {
        const fieldId = fieldKeyToId[fieldKey]
        if (!fieldId || !value) continue

        await admin
          .from('profile_values')
          .upsert(
            { user_id: profile.id, field_id: fieldId, value },
            { onConflict: 'user_id,field_id' }
          )
      }
    }

    // Update profile name
    await admin
      .from('profiles')
      .update({
        first_name: llProfile.firstName ?? profile.id,
        last_name: llProfile.lastName,
      })
      .eq('id', profile.id)

    return apiSuccess({ synced: true })
  } catch {
    return apiError('Internal server error', 500)
  }
}
