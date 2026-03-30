# Listing Leads Satellite App — Admin System Guide

How we built the admin system across ZMA Tool and Magic Buyer Letter. Copy this pattern for the next satellite app.

---

## Architecture Overview

```
                    Listing Leads (Hub)
                    ┌──────────────────┐
                    │  users table     │
                    │  solo_plan_ids   │  ← source of truth for plans
                    │  team_plan_ids   │
                    │  solo_plans      │
                    │  team_seat_tiers │
                    └────────┬─────────┘
                             │ READ-ONLY via createListingLeadsClient()
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                   ▼
   ┌─────────────┐   ┌─────────────┐    ┌─────────────┐
   │  ZMA Tool   │   │  MBL Tool   │    │  Next App   │
   │             │   │             │    │             │
   │ users       │   │ users       │    │ users       │
   │ allowed_    │   │ allowed_    │    │ allowed_    │
   │   plans     │   │   plans     │    │   plans     │
   └─────────────┘   └─────────────┘    └─────────────┘
      Each satellite has its OWN allowed_plans table
      (different apps can gate on different plans)
```

---

## Step 1: Database — Users Table + is_admin() Function

Every satellite starts with this in the initial migration.

### Migration: `00001_initial_schema.sql`

```sql
-- Users table with role column
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  memberstack_id TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
  active_plan_ids TEXT[] DEFAULT '{}',
  plan_name TEXT DEFAULT '',
  is_team_member BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Admin check function (used in RLS policies)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON users FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can update all users"
  ON users FOR UPDATE
  USING (is_admin());
```

**Key points:**
- `role` has CHECK constraint: `'user'`, `'admin'`, `'superadmin'`
- `is_admin()` checks for BOTH admin and superadmin (SECURITY DEFINER so it bypasses RLS)
- `active_plan_ids` is a TEXT array synced from LL during SSO login
- Admin roles are assigned directly in the DB (no self-service UI)

---

## Step 2: Database — allowed_plans Table

### Migration: `007_allowed_plans.sql`

```sql
CREATE TABLE IF NOT EXISTS allowed_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memberstack_plan_id TEXT UNIQUE NOT NULL,
  plan_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE allowed_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage allowed_plans"
  ON allowed_plans FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'superadmin')
  ));

CREATE POLICY "Authenticated users can read allowed_plans"
  ON allowed_plans FOR SELECT
  USING (auth.uid() IS NOT NULL);
```

**Key points:**
- `memberstack_plan_id` is UNIQUE — prevents duplicate entries
- Admins get full CRUD, regular users can only read (for plan-gate check)

---

## Step 3: Admin API Guard Middleware

### File: `src/lib/api/middleware.ts`

The `withAdminGuard()` function wraps any route handler to enforce admin role:

```typescript
import { createAdminClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'

type RouteHandler = (request: NextRequest, context?: any) => Promise<Response>

export function withAdminGuard(handler: RouteHandler): RouteHandler {
  return withErrorHandler(async (request, context) => {
    const user = await requireAuth()          // throws 401 if no session
    const admin = createAdminClient()         // bypasses RLS

    const { data: profile } = await admin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
      return apiError('Forbidden', 403)
    }

    return handler(request, context)
  })
}
```

**IMPORTANT:** Always check for BOTH `'admin'` and `'superadmin'`. ZMA had a bug where the guard only checked `role !== 'admin'` which locked out superadmins. MBL got this right with `['admin', 'superadmin'].includes()`.

---

## Step 4: Admin API — Allowed Plans Endpoint

### File: `src/app/api/admin/allowed-plans/route.ts`

This is the core admin endpoint — it reads plans from LL and manages the local allowlist.

```typescript
import { withAdminGuard } from '@/lib/api/middleware'
import { apiSuccess, apiError } from '@/lib/api/response'
import { createAdminClient } from '@/lib/supabase/server'
import { createListingLeadsClient } from '@/lib/supabase/listing-leads'
import { z } from 'zod'

const addPlanSchema = z.object({
  memberstack_plan_id: z.string().min(1),
  plan_name: z.string().min(1),
})

/** GET — list allowed plans + all available LL plans */
export const GET = withAdminGuard(async () => {
  const admin = createAdminClient()

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

  // Solo plans — DO NOT filter out is_legacy (we need them for active subscribers)
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
  const parsed = addPlanSchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Invalid input', 400)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('allowed_plans')
    .insert(parsed.data)
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

  const admin = createAdminClient()
  const { error } = await admin
    .from('allowed_plans')
    .delete()
    .eq('id', id)

  if (error) return apiError('Failed to remove plan', 500)
  return apiSuccess(null)
})
```

**Lesson learned:** We originally had `if (solo.is_legacy) continue` which filtered out legacy plans (Creator - Legacy, Exclusive Access, Fast Track, Just Start). This prevented admins from allowlisting users on those plans. **Never filter out legacy plans** — they have active subscribers.

---

## Step 5: Public Plan-Check Endpoint

### File: `src/app/api/allowed-plans/route.ts`

Non-admin endpoint that returns the list of allowed plan IDs. Used by the plan gate in the layout.

```typescript
import { withErrorHandler } from '@/lib/api/middleware'
import { apiSuccess, apiError } from '@/lib/api/response'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/server'

export const GET = withErrorHandler(async () => {
  const user = await getAuthUser()
  if (!user) return apiError('Unauthorized', 401)

  const admin = createAdminClient()
  const { data } = await admin
    .from('allowed_plans')
    .select('memberstack_plan_id')

  const allowedIds = (data ?? []).map((row) => row.memberstack_plan_id)
  return apiSuccess(allowedIds)
})
```

**Note:** This uses `createAdminClient()` (bypasses RLS) because the RLS policy on `allowed_plans` requires the user to be authenticated via Supabase auth, but the endpoint itself handles auth via `getAuthUser()`.

---

## Step 6: Plan Gate in Dashboard Layout

### File: `src/app/(dashboard)/layout.tsx`

The gate lives at the layout level — all dashboard pages either render content or show an upgrade page.

```typescript
// Inside the layout component:
const { data: allowedPlanIds } = useQuery<string[]>({
  queryKey: ['allowed-plans'],
  queryFn: async () => {
    const res = await fetch('/api/allowed-plans')
    const json = await res.json()
    return json.data ?? []
  },
  staleTime: 5 * 60_000,   // cache for 5 minutes
  enabled: !!user && !isAdmin, // skip for admins
})

const hasAllowedPlan = isAdmin || (
  allowedPlanIds !== undefined &&
  (allowedPlanIds.length === 0 ||   // no plans configured = no gate
    user?.activePlanIds?.some((id: string) => allowedPlanIds.includes(id)) === true)
)

// In the JSX:
{hasAllowedPlan ? children : <UpgradePage />}
```

**Gate logic:**
| Condition | Result |
|-----------|--------|
| User is admin/superadmin | Always allowed (query skipped entirely) |
| No plans in `allowed_plans` table | All users allowed (no gate) |
| User's `active_plan_ids` overlaps with allowed list | Allowed |
| No overlap | Shows `<UpgradePage />` |

---

## Step 7: SSO Callback — Syncing Plan Data

### File: `src/app/api/auth/ll-callback/route.ts`

When a user logs in via LL SSO, the callback syncs their plan data:

```typescript
// Inside the SSO callback handler, after JWT verification:
const updateData: Record<string, unknown> = {
  email: payload.email,
  name: payload.name,
  memberstack_id: payload.memberstack_id,
}

// Sync plan IDs from the JWT payload
if (payload.active_plan_ids) {
  updateData.active_plan_ids = payload.active_plan_ids  // TEXT[]
}
if (payload.is_team_member !== undefined) {
  updateData.is_team_member = payload.is_team_member
}

// Resolve plan name from LL database
if (payload.active_plan_ids?.length) {
  const planName = await resolvePlanName(payload.active_plan_ids)
  if (planName) updateData.plan_name = planName
}

await admin.from('users').upsert(updateData, { onConflict: 'memberstack_id' })
```

**Key:** The JWT from LL contains `active_plan_ids` (array of memberstack plan IDs). These are stored on the local `users` record and compared against `allowed_plans` in the gate.

---

## Step 8: Admin UI — Plans Management Page

### File: `src/app/(dashboard)/admin/plans/page.tsx`

```typescript
'use client'

interface AllowedPlan {
  id: string
  memberstack_plan_id: string
  plan_name: string
  created_at: string
}

interface AvailablePlan {
  memberstack_plan_id: string
  plan_name: string
  type: string           // 'solo' | 'team'
  is_legacy?: boolean    // show orange badge if true
}
```

**UI layout:**
1. **Allowed Plans card** — shows currently allowed plans with trash button to remove
2. **Available Plans card** — shows all LL plans with "Allow" button or "Allowed" badge

**Legacy badge pattern:**
```tsx
{plan.is_legacy && (
  <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-300">
    Legacy
  </span>
)}
```

---

## Step 9: Sidebar Navigation — Admin Section

### File: `src/components/Navigation.tsx`

```typescript
const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

// In the sidebar JSX:
{isAdmin && (
  <>
    <SidebarGroupLabel>Admin</SidebarGroupLabel>
    <SidebarGroupContent>
      {adminNavItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton asChild isActive={pathname === item.href}>
            <Link href={item.href}>
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarGroupContent>
  </>
)}
```

**Admin nav items vary per app:**

| ZMA Tool | Magic Buyer Letter |
|----------|-------------------|
| Dashboard (stats/charts) | Users |
| Users | Plans |
| Plans | Skills |
| Config (SMS prompt, concurrency) | Leaderboard |
| Batches | |
| Leaderboard | |
| SMS Skills | |

---

## Step 10: Admin RLS Bypass Policies

### Migration: `admin_rls_bypass.sql`

For every table admins need to read/write, add RLS policies:

```sql
-- Pattern: Admin can SELECT all rows in a table
CREATE POLICY "admins_select_all_<table>"
  ON <table> FOR SELECT
  USING (is_admin());

-- Pattern: Admin can UPDATE all rows
CREATE POLICY "admins_update_all_<table>"
  ON <table> FOR UPDATE
  USING (is_admin());

-- Pattern: Admin can INSERT (for tables like credit_ledger)
CREATE POLICY "admins_insert_<table>"
  ON <table> FOR INSERT
  WITH CHECK (is_admin());
```

**Apply to every app-specific table** (campaigns, properties, contacts, batches, etc.)

---

## Checklist for Next Satellite App

### Database Migrations
- [ ] `users` table with `role` CHECK constraint + `active_plan_ids` + `plan_name`
- [ ] `is_admin()` SQL function (SECURITY DEFINER)
- [ ] `allowed_plans` table with RLS
- [ ] Admin RLS bypass policies on all app tables
- [ ] `update_updated_at()` trigger

### Backend
- [ ] `withAdminGuard()` in `src/lib/api/middleware.ts` — checks `['admin', 'superadmin']`
- [ ] `GET/POST/DELETE /api/admin/allowed-plans` — manages plan allowlist
- [ ] `GET /api/allowed-plans` — public plan-check endpoint
- [ ] SSO callback syncs `active_plan_ids` and `plan_name` from LL JWT
- [ ] App-specific admin endpoints (users list, stats, config, etc.)

### Frontend
- [ ] Plan gate in `(dashboard)/layout.tsx` — `hasAllowedPlan` logic
- [ ] `<UpgradePage />` component for gated users
- [ ] Admin nav items in `Navigation.tsx` — conditional on `isAdmin`
- [ ] `/admin/plans/page.tsx` — plan management UI with legacy badges
- [ ] `/admin/users/page.tsx` — user management (varies per app)

### Environment Variables
- [ ] `LISTING_LEADS_SUPABASE_URL` — LL database URL (read-only)
- [ ] `LISTING_LEADS_SUPABASE_SERVICE_ROLE_KEY` — LL service key (read-only)
- [ ] `CROSS_APP_AUTH_SECRET` — JWT signing secret (shared across all satellites)
- [ ] Standard Supabase vars (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.)

---

## Gotchas & Lessons Learned

1. **Never filter out legacy plans** — We had `if (solo.is_legacy) continue` which blocked admins from allowlisting Creator - Legacy, Exclusive Access, Fast Track, Just Start. Legacy plans have active subscribers.

2. **Always check BOTH admin and superadmin** — Use `role IN ('admin', 'superadmin')` everywhere. ZMA had a bug where `withAdminGuard()` only checked `role !== 'admin'` which locked out superadmins.

3. **Team members have synthetic memberstack_ids** — Format: `team_<admin_id>_<random8>`. They don't have real MemberStack accounts, so plan checks work differently for them.

4. **Plan gate bypasses when no plans configured** — If `allowed_plans` table is empty, ALL authenticated users get access. This is intentional for initial setup before plans are configured.

5. **Admin query skips plan gate** — The `useQuery` for plan IDs has `enabled: !!user && !isAdmin` so admins never hit the plan-check endpoint.

6. **Use `createAdminClient()` (service role) in admin endpoints** — Regular server client respects RLS, which means admin users can only see their own data unless you add admin RLS policies. The admin client bypasses all RLS.

7. **The LL client is READ-ONLY** — `createListingLeadsClient()` connects to the LL Supabase with a service role key, but we only ever SELECT from it. Never write to LL from a satellite.

8. **active_plan_ids is synced on login only** — If a user's plan changes in LL, they need to re-login to the satellite app for the change to take effect. The 5-minute `staleTime` on the plan gate query doesn't help here since `active_plan_ids` comes from the local `users` table.
