import { createClient } from '@supabase/supabase-js'

/**
 * Read-only client for the Listing Leads hub database.
 * Used to fetch available plans from solo_plan_ids / team_plan_ids tables.
 */
export function createListingLeadsClient() {
  const url = process.env.LISTING_LEADS_SUPABASE_URL
  const key = process.env.LISTING_LEADS_SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing LISTING_LEADS_SUPABASE_URL or LISTING_LEADS_SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
