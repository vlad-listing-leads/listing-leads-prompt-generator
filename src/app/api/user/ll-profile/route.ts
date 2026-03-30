import { apiSuccess, apiError } from '@/lib/api/response'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getListingLeadsProfile } from '@/lib/supabase/listing-leads'

/**
 * GET /api/user/ll-profile
 * Fetches the current user's profile from the Listing Leads database.
 * Returns display-only data — users must edit on listingleads.com.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return apiError('Unauthorized', 401)
    }

    const admin = await createServiceClient()

    // Look up memberstack_id from profiles table
    const { data: profile } = await admin
      .from('profiles')
      .select('memberstack_id')
      .eq('id', user.id)
      .single()

    if (!profile?.memberstack_id) {
      return apiError('No Listing Leads account linked', 404)
    }

    const llProfile = await getListingLeadsProfile(profile.memberstack_id)

    if (!llProfile) {
      return apiError('Listing Leads profile not found', 404)
    }

    return apiSuccess(llProfile)
  } catch {
    return apiError('Internal server error', 500)
  }
}
