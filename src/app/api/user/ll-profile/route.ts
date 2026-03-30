import { apiSuccess, apiError } from '@/lib/api/response'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getListingLeadsProfile, createListingLeadsClient } from '@/lib/supabase/listing-leads'

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

    // Look up memberstack_id and active_plan_ids from profiles table
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

    // Resolve plan name from LL database
    let planName: string | null = null
    try {
      const llClient = createListingLeadsClient()

      // Check if user has a selected_plan_id in their LL profile
      const { data: llUser } = await llClient
        .from('profiles')
        .select('selected_plan_id')
        .eq('memberstack_id', profile.memberstack_id)
        .single()

      if (llUser?.selected_plan_id) {
        // Try solo plans
        const { data: soloRow } = await llClient
          .from('solo_plans')
          .select('plan_name')
          .eq('id', llUser.selected_plan_id)
          .maybeSingle()

        if (soloRow) {
          planName = soloRow.plan_name
        }

        // Try team plans if solo not found
        if (!planName) {
          const { data: teamRow } = await llClient
            .from('team_plans')
            .select('plan_name')
            .eq('id', llUser.selected_plan_id)
            .maybeSingle()

          if (teamRow) {
            planName = teamRow.plan_name
          }
        }
      }
    } catch {
      // Non-critical
    }

    return apiSuccess({
      ...llProfile,
      planName,
      themePreference: llProfile.themePreference ?? null,
    })
  } catch {
    return apiError('Internal server error', 500)
  }
}
