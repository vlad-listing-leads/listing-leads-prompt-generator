import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * GET /api/version
 * Returns the current build ID. Used by VersionChecker to detect new deploys.
 */
export async function GET() {
  let buildId = 'unknown'
  try {
    buildId = readFileSync(join(process.cwd(), '.next', 'BUILD_ID'), 'utf-8').trim()
  } catch {
    // BUILD_ID not available
  }

  return NextResponse.json(
    { deployId: buildId },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
