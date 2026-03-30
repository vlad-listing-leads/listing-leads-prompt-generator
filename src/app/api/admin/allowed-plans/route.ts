import { NextRequest } from 'next/server'
import { withAdminGuard } from '@/lib/api/middleware'
import { apiSuccess, apiError } from '@/lib/api/response'
import { createServiceClient } from '@/lib/supabase/server'
import { createListingLeadsClient } from '@/lib/supabase/listing-leads'

/** GET — list allowed plans + all available LL plans */
export const GET = withAdminGuard(async () => {
  const admin = await createServiceClient()

  // 1. Fetch locally allowed plans
  const { data: allowed, error } = await admin
    .from('allowed_plans')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return apiError('Failed to fetch allowed plans', 500)

  // 2. Fetch ALL plans from Listing Leads database
  const llClient = createListingLeadsClient()

  const [soloResult, teamResult] = await Promise.all([
    llClient
      .from('solo_plan_ids')
      .select('memberstack_plan_id, billing_interval, label, solo_plans!inner(plan_name, tier, is_legacy)')
      .order('display_order'),
    llClient
      .from('team_plan_ids')
      .select('memberstack_plan_id, billing_interval, label, team_seat_tiers!inner(seat_limit, team_plans!inner(plan_name))')
      .order('display_order'),
  ])

  const availablePlans: Array<{
    memberstack_plan_id: string
    plan_name: string
    type: string
    is_legacy: boolean
  }> = []

  // Solo plans — DO NOT filter out is_legacy (they have active subscribers)
  if (soloResult.data) {
    for (const row of soloResult.data) {
      const solo = row.solo_plans as unknown as { plan_name: string; tier: string; is_legacy: boolean }
      availablePlans.push({
        memberstack_plan_id: row.memberstack_plan_id,
        plan_name: `${solo.plan_name} (${row.billing_interval})`,
        type: 'solo',
        is_legacy: solo.is_legacy ?? false,
      })
    }
  }

  // Team plans (never legacy)
  if (teamResult.data) {
    for (const row of teamResult.data) {
      const tier = row.team_seat_tiers as unknown as { seat_limit: number; team_plans: { plan_name: string } }
      availablePlans.push({
        memberstack_plan_id: row.memberstack_plan_id,
        plan_name: `${tier.team_plans.plan_name} - ${tier.seat_limit} seats (${row.billing_interval})`,
        type: 'team',
        is_legacy: false,
      })
    }
  }

  return apiSuccess({ allowed, availablePlans })
})

/** POST — add a plan to the allowed list */
export const POST = withAdminGuard(async (request: NextRequest) => {
  const body = await request.json()
  const { memberstack_plan_id, plan_name } = body

  if (!memberstack_plan_id || !plan_name) {
    return apiError('memberstack_plan_id and plan_name are required', 400)
  }

  const admin = await createServiceClient()
  const { data, error } = await admin
    .from('allowed_plans')
    .insert({ memberstack_plan_id, plan_name })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return apiError('Plan already in allowed list', 409)
    return apiError('Failed to add plan', 500)
  }

  return apiSuccess(data, 201)
})

/** DELETE — remove a plan */
export const DELETE = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')
  if (!id) return apiError('Missing id parameter', 400)

  const admin = await createServiceClient()
  const { error } = await admin
    .from('allowed_plans')
    .delete()
    .eq('id', id)

  if (error) return apiError('Failed to remove plan', 500)
  return apiSuccess(null)
})
