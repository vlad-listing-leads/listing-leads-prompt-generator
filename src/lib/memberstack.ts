// Memberstack configuration
export const MEMBERSTACK_APP_ID = process.env.NEXT_PUBLIC_MEMBERSTACK_APP_ID
export const MEMBERSTACK_LOGIN_URL = process.env.NEXT_PUBLIC_MEMBERSTACK_LOGIN_URL || 'https://listingleads.com/login'

// Type definitions for Memberstack member object
export interface MemberstackMember {
  id: string
  auth: {
    email: string
  }
  customFields?: Record<string, string>
  metaData?: Record<string, unknown>
  planConnections?: Array<{
    planId: string
    status: string
  }>
}

// Memberstack DOM response type
export interface MemberstackResponse {
  data: MemberstackMember | null
}

// Declare global type for Memberstack DOM
declare global {
  interface Window {
    $memberstackDom?: {
      getCurrentMember: () => Promise<MemberstackResponse>
    }
  }
}

// Helper to check if Memberstack is loaded
export function isMemberstackLoaded(): boolean {
  return typeof window !== 'undefined' && !!window.$memberstackDom
}

// Helper to get current member (returns null if not logged in)
export async function getCurrentMember(): Promise<MemberstackMember | null> {
  if (!isMemberstackLoaded()) {
    return null
  }

  try {
    const response = await window.$memberstackDom!.getCurrentMember()
    return response.data
  } catch (error) {
    console.error('Error getting Memberstack member:', error)
    return null
  }
}

// Redirect to Memberstack login
export function redirectToMemberstackLogin(): void {
  if (typeof window !== 'undefined') {
    window.location.href = MEMBERSTACK_LOGIN_URL
  }
}
