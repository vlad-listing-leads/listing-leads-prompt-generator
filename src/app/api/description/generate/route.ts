import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Lazy initialization to avoid build-time errors
let openai: OpenAI | null = null

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

export async function POST(request: NextRequest) {
  try {
    const { html, name } = await request.json()

    if (!html) {
      return NextResponse.json(
        { error: 'HTML content is required' },
        { status: 400 }
      )
    }

    // Extract text content from HTML for context (limit to avoid token limits)
    const textContent = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000)

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that writes brief, professional descriptions for marketing templates. Keep descriptions concise (1-2 sentences) and focus on the template\'s purpose and style. Do not use quotes around the description.',
        },
        {
          role: 'user',
          content: `Write a brief description for this marketing template${name ? ` named "${name}"` : ''}. Here's some text content from the template:\n\n${textContent}`,
        },
      ],
      max_tokens: 100,
      temperature: 0.7,
    })

    const description = completion.choices[0]?.message?.content?.trim() || ''

    return NextResponse.json({ description })
  } catch (error) {
    console.error('Description generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate description' },
      { status: 500 }
    )
  }
}
