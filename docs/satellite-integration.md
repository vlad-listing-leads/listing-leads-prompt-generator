# Satellite App Integration Guide

## Overview

The `/api/auth/satellite/verify` endpoint on `listingleads.com` allows satellite apps (Expired Editor, ZMA Tool, Magic Buyer Letter, and future apps on `*.listingleads.com`) to verify a user's current subscription tier and plan status. Instead of relying solely on the short-lived JWT from SSO login (which contains no plan info), satellite apps call this endpoint to get the user's full profile, active plan IDs, and resolved tier -- enabling proper feature gating across the Listing Leads ecosystem.

## Prerequisites

- Satellite app must be hosted on a `*.listingleads.com` subdomain (e.g., `zma.listingleads.com`)
- `CROSS_APP_AUTH_SECRET` environment variable set in your Vercel project -- must match the main app's value exactly
- `SESSION_SECRET` environment variable for encrypting your local session cookie (generate with `openssl rand -base64 32`)
- `jose` npm package for JWT handling (`npm install jose`)
- Next.js App Router (all examples below use the App Router pattern)

## Authentication Flow

1. User visits your satellite app (unauthenticated -- no session cookie)
2. Your middleware redirects to `https://listingleads.com/auth/sso-redirect?returnTo=https://your-app.listingleads.com`
3. The main app authenticates the user (or uses their existing Memberstack session), generates a JWT (60-second expiry), and redirects to `https://your-app.listingleads.com/api/auth/ll-callback?token=<JWT>`
4. Your callback route calls `GET https://listingleads.com/api/auth/satellite/verify` with the JWT as a Bearer token
5. The response (user profile, tier, plan IDs) is cached in an encrypted httpOnly session cookie with a 5-minute freshness window
6. Subsequent page loads read the cookie; when stale (>5 min), the user is transparently re-authenticated via SSO

## Step 1: Obtain a JWT (SSO Callback)

When an unauthenticated user hits your app, redirect them to the main app's SSO endpoint:

```
https://listingleads.com/auth/sso-redirect?returnTo=https://your-app.listingleads.com
```

The main app authenticates the user and redirects back to your `/api/auth/ll-callback` route with a `token` query parameter. This JWT contains `{ memberstackId, email, role, name, timestamp }` and expires after 60 seconds.

Here is a complete callback route that verifies the JWT, calls the satellite verify endpoint, and creates a session cookie:

```typescript
// app/api/auth/ll-callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

const SESSION_SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!)
const CROSS_APP_SECRET = process.env.CROSS_APP_AUTH_SECRET!

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Verify the JWT from the main app
  try {
    await jwtVerify(token, new TextEncoder().encode(CROSS_APP_SECRET))
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Call the satellite verify endpoint to get full user data
  const verifyRes = await fetch('https://listingleads.com/api/auth/satellite/verify', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!verifyRes.ok) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { user } = await verifyRes.json()

  // Create an encrypted session cookie
  const session = await new SignJWT({
    user,
    lastFetched: Date.now(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(SESSION_SECRET)

  const cookieStore = await cookies()
  cookieStore.set('ll-session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 86400, // 24 hours
  })

  return NextResponse.redirect(new URL('/', request.url))
}
```

> **Important:** The JWT expires after 60 seconds. You must call `/api/auth/satellite/verify` immediately inside the callback route -- do not defer it or store the token for later use.

## Step 2: Verify the User's Plan

### Request

```
GET https://listingleads.com/api/auth/satellite/verify
Authorization: Bearer <jwt-token>
```

**curl example:**

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..." \
  https://listingleads.com/api/auth/satellite/verify
```

**fetch example:**

```typescript
const response = await fetch('https://listingleads.com/api/auth/satellite/verify', {
  headers: { Authorization: `Bearer ${token}` },
})
const data = await response.json()
```

### Response Schema

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `verified` | `boolean` | Always `true` on success | `true` |
| `user.id` | `string` | Supabase profile UUID | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |
| `user.email` | `string` | User's email address | `"agent@example.com"` |
| `user.name` | `string \| null` | Full name (first + last) or null if not set | `"Jane Smith"` |
| `user.role` | `string` | User role in the system | `"user"` |
| `user.tier` | `"FREE" \| "BASIC" \| "PRO" \| "CREATOR" \| "TEAM"` | Highest active plan tier | `"PRO"` |
| `user.activePlanIds` | `string[]` | Memberstack plan IDs with ACTIVE or TRIALING status | `["pln_pro_monthly"]` |
| `user.isTeamMember` | `boolean` | Whether user is a team member (inherits manager's plan) | `false` |

> **Note:** Tier is resolved from database tables (`solo_plans`, `solo_plan_ids`, `team_plan_ids`), not hardcoded. Team members inherit their manager's plan tier. If the Memberstack API is temporarily unavailable, the endpoint fails open to `FREE` tier with an empty `activePlanIds` array.

**Example success response:**

```json
{
  "verified": true,
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "agent@example.com",
    "name": "Jane Smith",
    "role": "user",
    "tier": "PRO",
    "activePlanIds": ["pln_pro_monthly"],
    "isTeamMember": false
  }
}
```

### TypeScript Interface

```typescript
interface SatelliteVerifyResponse {
  verified: true
  user: {
    id: string
    email: string
    name: string | null
    role: string
    tier: 'FREE' | 'BASIC' | 'PRO' | 'CREATOR' | 'TEAM'
    activePlanIds: string[]
    isTeamMember: boolean
  }
}

interface SatelliteVerifyError {
  error: string
  verified?: false
}
```

### Error Responses

| Status | Body | When |
|--------|------|------|
| `401` | `{ "error": "Invalid or expired token" }` | Missing, invalid, or expired Bearer token |
| `404` | `{ "error": "User not found", "verified": false }` | No profile exists for the `memberstackId` in the JWT |
| `429` | `{ "error": "Too many requests", "message": "Rate limit exceeded...", "retryAfter": N }` | Rate limit exceeded (30 req/min per IP). Response includes `Retry-After` header |
| `500` | `{ "error": "Internal server error" }` | Server error (e.g., missing `CROSS_APP_AUTH_SECRET` env var, database failure) |

## Step 3: Cache in Session Cookie

Store the verified user data in an encrypted session cookie so you don't need to call the verify endpoint on every page load. Use a `lastFetched` timestamp to track freshness.

```typescript
// lib/session.ts
import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!)

export interface SessionData {
  user: {
    id: string
    email: string
    name: string | null
    role: string
    tier: 'FREE' | 'BASIC' | 'PRO' | 'CREATOR' | 'TEAM'
    activePlanIds: string[]
    isTeamMember: boolean
  }
  lastFetched: number
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('ll-session')?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionData
  } catch {
    return null
  }
}

export async function setSession(data: SessionData): Promise<void> {
  const token = await new SignJWT(data as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(SECRET)

  const cookieStore = await cookies()
  cookieStore.set('ll-session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 86400,
  })
}
```

## Step 4: Middleware -- Read Cache, Refetch When Stale

Use Next.js middleware to check the session cookie on every request. If the cookie is missing, redirect to SSO. If it's valid but stale (older than 5 minutes), mark it so the page can trigger a background re-authentication.

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!)
const STALE_MS = 5 * 60 * 1000 // 5 minutes

export async function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get('ll-session')?.value

  if (!sessionToken) {
    // No session -- redirect to main app SSO
    const returnTo = encodeURIComponent(request.url)
    return NextResponse.redirect(
      `https://listingleads.com/auth/sso-redirect?returnTo=${returnTo}`
    )
  }

  try {
    const { payload } = await jwtVerify(sessionToken, SECRET)
    const lastFetched = (payload as { lastFetched?: number }).lastFetched ?? 0
    const isStale = Date.now() - lastFetched > STALE_MS

    const response = NextResponse.next()

    // Pass user data to the page via headers
    response.headers.set(
      'x-user-tier',
      String((payload as { user?: { tier?: string } }).user?.tier ?? 'FREE')
    )

    if (isStale) {
      // Signal the page to refetch in the background
      response.headers.set('x-session-stale', 'true')
    }

    return response
  } catch {
    // Invalid/expired session cookie -- re-authenticate
    const returnTo = encodeURIComponent(request.url)
    return NextResponse.redirect(
      `https://listingleads.com/auth/sso-redirect?returnTo=${returnTo}`
    )
  }
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|public).*)'],
}
```

## Caching Strategy

### Why 5 Minutes?

Plan changes are rare events -- they happen when a user upgrades, downgrades, or when a payment fails. These are billing events that occur at most a few times per month. A 5-minute staleness window strikes the right balance:

- **Avoids hammering the main app API** on every page load (which would hit rate limits quickly)
- **Keeps data reasonably fresh** -- worst case, a user upgrades and sees their old tier for up to 5 minutes
- **Simplifies implementation** -- no websockets, no webhooks, just a simple timestamp check

### Flow Diagram

```
SSO Callback (first visit)
  |-> Redirect to listingleads.com/auth/sso-redirect
  |-> Main app authenticates user, generates JWT (60s expiry)
  |-> Redirect to your-app.listingleads.com/api/auth/ll-callback?token=<JWT>
  |-> Callback calls GET /api/auth/satellite/verify with Bearer token
  |-> Set encrypted session cookie with { user, lastFetched: Date.now() }
       |
Page Load (middleware checks cookie)
  |-- Cookie missing?          -> Redirect to SSO
  |-- Cookie valid, fresh (<5 min)? -> Serve page immediately
  |-- Cookie valid, stale (>5 min)? -> Serve page + signal background refetch
       |
Background Refetch (when stale)
  |-> Redirect user through SSO again (transparent -- they're already logged in)
  |-> New callback sets fresh session cookie with updated lastFetched
```

### Background Refetch

Since the JWT from the main app expires after 60 seconds, you cannot re-call `/api/auth/satellite/verify` with the original token after it expires. For background refetch when the session is stale, the recommended approach is:

**If the page needs fresh tier data**, redirect the user through SSO again. Because they're already logged in on the main app, this is instant and transparent -- no login screen appears. The SSO flow generates a fresh JWT, your callback re-verifies, and the session cookie is updated.

Here is an API route your client-side code can call to check staleness:

```typescript
// app/api/auth/refresh-session/route.ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

const STALE_MS = 5 * 60 * 1000 // 5 minutes

export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No session' }, { status: 401 })
  }

  const isStale = Date.now() - session.lastFetched > STALE_MS

  if (isStale) {
    // Signal the client to redirect through SSO for a fresh session
    return NextResponse.json({ stale: true, redirectToSSO: true })
  }

  return NextResponse.json({ stale: false, user: session.user })
}
```

And the client-side hook to trigger a transparent re-authentication:

```typescript
// hooks/useSessionRefresh.ts
'use client'
import { useEffect } from 'react'

export function useSessionRefresh() {
  useEffect(() => {
    async function checkSession() {
      const res = await fetch('/api/auth/refresh-session', { method: 'POST' })
      const data = await res.json()
      if (data.redirectToSSO) {
        // Transparent re-auth -- user won't see a login screen
        window.location.href = `https://listingleads.com/auth/sso-redirect?returnTo=${encodeURIComponent(window.location.href)}`
      }
    }
    checkSession()
  }, [])
}
```

## Rate Limiting

The `/api/auth/satellite/verify` endpoint is rate limited to **30 requests per minute per IP address** (the `GENERAL` rate limit tier).

When the limit is exceeded, the endpoint returns:

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again in 30 seconds.",
  "retryAfter": 30
}
```

The response includes a `Retry-After` header with the number of seconds to wait.

**Best practice:** Cache aggressively using the session cookie pattern described above. You should never need more than 1 verify call per user session (in the SSO callback). If you're hitting rate limits, you're calling the endpoint too often -- use the cached session instead.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401 Invalid or expired token` | JWT is older than 60 seconds | Ensure the verify call happens immediately in the SSO callback, not deferred or stored for later |
| `401 Invalid or expired token` | Wrong `CROSS_APP_AUTH_SECRET` | Verify your env var matches the main app's value exactly (check both Vercel project dashboards) |
| `404 User not found` | User has no profile in Supabase | User may not have completed signup; check the `profiles` table for their `memberstack_id` |
| `429 Too many requests` | Exceeded 30 req/min per IP | Implement session cookie caching; don't call verify on every page load |
| `tier` is `FREE` but user has a plan | Memberstack API temporarily unavailable | Endpoint fails open to `FREE` tier; the user can retry or wait for Memberstack to recover |
| `isTeamMember` is `true` but `tier` is `FREE` | Manager's Memberstack subscription lapsed | Team members inherit their manager's current status; if the manager's subscription is inactive, the team member gets `FREE` |
| Session cookie exists but user sees wrong tier | Session data is stale (>5 min old) | Trigger a re-authentication via SSO redirect to refresh the session |

## Full Example: Putting It All Together

A satellite app needs these files to integrate with the verify endpoint:

| File | Purpose |
|------|---------|
| `app/api/auth/ll-callback/route.ts` | Receives JWT from SSO redirect, calls verify endpoint, creates session cookie |
| `lib/session.ts` | Utilities for reading/writing the encrypted session cookie (`getSession`, `setSession`) |
| `middleware.ts` | Checks session cookie on every request; redirects to SSO if missing/expired; signals staleness |
| `app/api/auth/refresh-session/route.ts` | API route for client-side staleness checks |
| `hooks/useSessionRefresh.ts` | Client hook that triggers transparent re-auth when session is stale |

**Environment variables required:**

```env
CROSS_APP_AUTH_SECRET=<same value as main listingleads.com app>
SESSION_SECRET=<your own secret for encrypting session cookies>
```

The integration flow is: **SSO redirect -> callback -> verify -> session cookie -> middleware -> serve pages**. After the initial SSO callback, all subsequent page loads are served from the cached session cookie with no external API calls until the 5-minute freshness window expires.
