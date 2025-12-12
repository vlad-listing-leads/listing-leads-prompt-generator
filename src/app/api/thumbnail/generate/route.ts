import { NextRequest, NextResponse } from 'next/server'
import { generateThumbnail } from '@/lib/thumbnail-service'

export async function POST(request: NextRequest) {
  try {
    const { html, name } = await request.json()

    if (!html) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 })
    }

    const result = await generateThumbnail(html, name)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Thumbnail generation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to generate thumbnail: ${errorMessage}` },
      { status: 500 }
    )
  }
}
