import { withErrorHandler } from '@/lib/api/middleware'
import { apiSuccess, apiError } from '@/lib/api/response'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

/** GET — returns list of allowed plan IDs (for plan gate in layout) */
export const GET = withErrorHandler(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return apiError('Unauthorized', 401)

  const admin = await createServiceClient()
  const { data } = await admin
    .from('allowed_plans')
    .select('memberstack_plan_id')

  const allowedIds = (data ?? []).map((row) => row.memberstack_plan_id)
  return apiSuccess(allowedIds)
})
