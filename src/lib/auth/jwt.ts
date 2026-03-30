import { jwtVerify, SignJWT } from 'jose'

/** JWT payload from Listing Leads cross-app token */
export interface LLTokenPayload {
  memberstackId: string
  email: string
  role: string
  name?: string
  timestamp: number
}

/**
 * Verify a cross-app JWT token from Listing Leads.
 * Token must be signed with CROSS_APP_AUTH_SECRET (HS256).
 * Token expires in 60 seconds.
 */
export async function verifyLLToken(token: string): Promise<LLTokenPayload | null> {
  try {
    const secret = process.env.CROSS_APP_AUTH_SECRET
    if (!secret) {
      console.error('[jwt] CROSS_APP_AUTH_SECRET not set')
      return null
    }

    const key = new TextEncoder().encode(secret)
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    })

    const { memberstackId, email, role, name, timestamp } = payload as unknown as LLTokenPayload

    // Validate required fields
    if (!memberstackId || !email) {
      console.warn('[jwt] JWT missing required fields')
      return null
    }

    // Check token age (60 seconds max)
    const age = Date.now() - timestamp
    if (age > 60_000) {
      console.warn('[jwt] JWT token expired, age:', age)
      return null
    }

    return { memberstackId, email, role: role || 'user', name, timestamp }
  } catch (error) {
    console.error('[jwt] JWT verification failed:', error)
    return null
  }
}

/**
 * Create a cross-app JWT token (for testing or inter-service calls).
 */
export async function createLLToken(payload: Omit<LLTokenPayload, 'timestamp'>): Promise<string> {
  const secret = process.env.CROSS_APP_AUTH_SECRET
  if (!secret) throw new Error('CROSS_APP_AUTH_SECRET not set')

  const key = new TextEncoder().encode(secret)
  return new SignJWT({ ...payload, timestamp: Date.now() })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('60s')
    .sign(key)
}
