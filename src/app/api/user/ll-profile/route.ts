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

    // Resolve plan name from LL database using memberstack plan IDs
    let planName: string | null = null
    try {
      const llClient = createListingLeadsClient()

      // Get user's memberstack plan connections
      const { data: planConnections } = await llClient
        .from('solo_plan_ids')
        .select('memberstack_plan_id, solo_plans!inner(plan_name)')
        .limit(50)

      // Get user's active plans from memberstack via their LL profile
      const { data: llUser } = await llClient
        .from('profiles')
        .select('selected_plan_id')
        .eq('memberstack_id', profile.memberstack_id)
        .single()

      if (llUser?.selected_plan_id) {
        // Try solo plans by selected_plan_id
        const { data: soloRow } = await llClient
          .from('solo_plans')
          .select('plan_name')
          .eq('id', llUser.selected_plan_id)
          .maybeSingle()

        if (soloRow) {
          planName = soloRow.plan_name
        }

        // Try team plans
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

      // Fallback: try dev_tier as plan name
      if (!planName && llProfile.role === 'superadmin') {
        planName = 'Super Admin'
      }
    } catch {
      // Non-critical
    }

    return apiSuccess({
      ...llProfile,
      planName,
    })
  } catch {
    return apiError('Internal server error', 500)
  }
}
