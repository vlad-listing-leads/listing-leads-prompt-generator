import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'

type RouteHandler = (request: NextRequest, context?: unknown) => Promise<Response>

export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (err) {
      console.error('[API Error]', err)
      return apiError('Internal server error', 500)
    }
  }
}

export function withAdminGuard(handler: RouteHandler): RouteHandler {
  return withErrorHandler(async (request, context) => {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return apiError('Unauthorized', 401)
    }

    const admin = await createServiceClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
      return apiError('Forbidden', 403)
    }

    return handler(request, context)
  })
}
