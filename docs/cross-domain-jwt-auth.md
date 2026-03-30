# Cross-Domain JWT Auto-Login from listingleads.com

## Overview

When a user clicks a link on the main **listingleads.com** (v2 app / Webflow + Memberstack) that points to this **prompt generator app** (Next.js + Supabase), they are automatically logged in without needing to enter credentials again. This is achieved using a short-lived JWT token passed as a URL query parameter.

## How It Works (Step by Step)

### 1. V2 App Generates a JWT

On `listingleads.com`, when a user clicks a link to the prompt generator (e.g. "Go to Description Generator"), the v2 app:

1. Takes the logged-in user's **Memberstack ID** and **email**
2. Creates a JWT with this payload:
   ```json
   {
     "memberstackId": "mem_abc123",
     "email": "user@example.com",
     "timestamp": 1700000000,
     "exp": 1700000300
   }
   ```
3. Signs the JWT using **HMAC-SHA256** with the shared `CROSS_APP_AUTH_SECRET`
4. Appends the token as a query parameter to the URL:
   ```
   https://prompts.listingleads.com/?authToken=eyJhbGciOiJIUzI1NiJ9...
   ```

### 2. Prompt Generator App Detects the Token

When the app loads, the `MemberstackAuthProvider` component (`src/components/MemberstackAuthProvider.tsx`) runs an auth flow:

1. Checks if the user already has a valid Supabase session — if yes, done
2. Checks the URL for an `authToken` query parameter
3. If found, calls the cross-domain auth API endpoint before falling back to Memberstack SDK auth

### 3. Backend Verifies the JWT

The frontend sends the token to `POST /api/auth/cross-domain` (`src/app/api/auth/cross-domain/route.ts`), which:

1. **Parses** the JWT into header, payload, and signature
2. **Verifies the HMAC-SHA256 signature** using the shared `CROSS_APP_AUTH_SECRET` env var
3. **Checks expiration** — rejects if `exp` is in the past
4. **Validates required fields** — `memberstackId`, `email`, and `exp` must all be present

### 4. User Is Resolved or Created in Supabase

After the JWT is verified, the backend resolves the user:

| Scenario | Action |
|---|---|
| Profile with matching `memberstack_id` exists | Use that user's existing Supabase account |
| No profile match, but email exists in `auth.users` | Link the `memberstack_id` to the existing Supabase account |
| No match at all | Create a new Supabase user and profile with the `memberstack_id` |

### 5. Magic Link Token Is Generated and Returned

The backend uses Supabase Admin API to generate a **magic link** for the user's email, then extracts the OTP token hash from it and returns it to the frontend:

```json
{
  "success": true,
  "token": "pkce_abc123...",
  "type": "magiclink"
}
```

### 6. Frontend Establishes the Supabase Session

The frontend receives the token and calls:

```ts
supabase.auth.verifyOtp({
  token_hash: data.token,
  type: 'magiclink',
})
```

This creates a full Supabase auth session (with cookies), and the user is now logged in. The `authToken` query parameter is silently removed from the URL via `history.replaceState`.

## Architecture Diagram

```
listingleads.com (v2)                    prompts.listingleads.com (this app)
┌─────────────────────┐                  ┌──────────────────────────────────┐
│                     │                  │                                  │
│  User clicks link   │                  │  MemberstackAuthProvider         │
│  to prompt editor   │                  │  ┌────────────────────────────┐  │
│         │           │                  │  │ Detects ?authToken in URL  │  │
│         ▼           │                  │  └────────────┬───────────────┘  │
│  Generate JWT with  │    redirect      │               │                  │
│  memberstackId +    │ ──────────────►  │               ▼                  │
│  email + expiry     │  ?authToken=...  │  POST /api/auth/cross-domain     │
│  Sign with shared   │                  │  ┌────────────────────────────┐  │
│  CROSS_APP_AUTH_    │                  │  │ 1. Verify JWT signature    │  │
│  SECRET             │                  │  │ 2. Check expiration        │  │
│                     │                  │  │ 3. Find/create Supabase    │  │
└─────────────────────┘                  │  │    user                    │  │
                                         │  │ 4. Generate magic link     │  │
                                         │  │    token                   │  │
                                         │  └────────────┬───────────────┘  │
                                         │               │                  │
                                         │               ▼                  │
                                         │  supabase.auth.verifyOtp()       │
                                         │  ┌────────────────────────────┐  │
                                         │  │ Session created ✓          │  │
                                         │  │ authToken removed from URL │  │
                                         │  └────────────────────────────┘  │
                                         └──────────────────────────────────┘
```

## Key Files

| File | Purpose |
|---|---|
| `src/app/api/auth/cross-domain/route.ts` | Backend: verifies JWT, resolves user, generates magic link token |
| `src/components/MemberstackAuthProvider.tsx` | Frontend: detects `authToken` param, calls API, establishes Supabase session |
| `src/app/auth/callback/route.ts` | Older HMAC-based auth callback (GET-based, used for direct redirects) |
| `src/app/api/auth/memberstack/route.ts` | Fallback auth: Memberstack SDK session → Supabase session (same-domain) |
| `src/lib/memberstack.ts` | Memberstack SDK types and helpers |

## Environment Variables

| Variable | Description |
|---|---|
| `CROSS_APP_AUTH_SECRET` | Shared HMAC-SHA256 secret between v2 app and this app for signing/verifying JWTs |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (used server-side to create users and generate magic links) |

## Security Considerations

- **Short-lived tokens**: The JWT has an `exp` claim; expired tokens are rejected
- **HMAC-SHA256 signature**: Prevents token forgery — only apps with the shared secret can create valid tokens
- **Token removed from URL**: The `authToken` is stripped from the browser URL immediately after use to prevent leakage via referrer headers or browser history
- **Single-use magic links**: The Supabase magic link token can only be used once
- **Server-side verification only**: JWT verification happens on the backend, never in client-side code
