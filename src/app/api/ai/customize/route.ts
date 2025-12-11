import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// For prompt-only changes, use Haiku for speed
async function applyPromptChanges(htmlContent: string, userPrompt: string): Promise<string> {
  const prompt = `Apply this change to the HTML: "${userPrompt}"

${htmlContent}

Return ONLY the modified HTML.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-20250514',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseContent = message.content[0]
  if (responseContent.type !== 'text') {
    throw new Error('Unexpected response type')
  }

  let modifiedHtml = responseContent.text.trim()

  // Clean up any markdown code blocks if present
  if (modifiedHtml.startsWith('```html')) {
    modifiedHtml = modifiedHtml.slice(7)
  } else if (modifiedHtml.startsWith('```')) {
    modifiedHtml = modifiedHtml.slice(3)
  }
  if (modifiedHtml.endsWith('```')) {
    modifiedHtml = modifiedHtml.slice(0, -3)
  }

  return modifiedHtml.trim()
}

// For initial personalization with field values
async function applyFieldValues(htmlContent: string, fields: Array<{field_key: string; label: string; field_type: string}>, values: Record<string, string>, userPrompt?: string): Promise<string> {
  const fieldDescriptions = fields
    .map((f) => {
      const value = values[f.field_key]
      if (!value) return null
      return `- ${f.label} (${f.field_key}, type: ${f.field_type}): "${value}"`
    })
    .filter(Boolean)
    .join('\n')

  let prompt = `You are an HTML template customization expert. Modify this template with the provided values.

HTML:
${htmlContent}

Field values:
${fieldDescriptions}`

  if (userPrompt) {
    prompt += `

Additional instruction: "${userPrompt}"`
  }

  prompt += `

Rules:
1. Replace appropriate content with the field values
2. Names go in name/contact sections, phones replace phones, emails replace emails
3. For COLOR fields, apply to appropriate CSS styles
4. Maintain HTML structure

Return ONLY the modified HTML. No explanations, no markdown.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseContent = message.content[0]
  if (responseContent.type !== 'text') {
    throw new Error('Unexpected response type')
  }

  let modifiedHtml = responseContent.text.trim()

  // Clean up any markdown code blocks if present
  if (modifiedHtml.startsWith('```html')) {
    modifiedHtml = modifiedHtml.slice(7)
  } else if (modifiedHtml.startsWith('```')) {
    modifiedHtml = modifiedHtml.slice(3)
  }
  if (modifiedHtml.endsWith('```')) {
    modifiedHtml = modifiedHtml.slice(0, -3)
  }

  return modifiedHtml.trim()
}

export async function POST(request: NextRequest) {
  try {
    const { htmlContent, fields, values, userPrompt } = await request.json()

    if (!htmlContent) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 })
    }

    const safeFields = fields || []
    const safeValues = values || {}

    // Build the field descriptions
    const fieldDescriptions = safeFields
      .map((f: { field_key: string; label: string; field_type: string }) => {
        const value = safeValues[f.field_key]
        if (!value) return null
        return `- ${f.label}: "${value}"`
      })
      .filter(Boolean)

    const hasFieldValues = fieldDescriptions.length > 0

    if (!hasFieldValues && !userPrompt) {
      // No values to replace and no prompt, return original
      return NextResponse.json({ html: htmlContent })
    }

    let modifiedHtml: string

    if (userPrompt && !hasFieldValues) {
      // User prompt only - use shorter, faster prompt
      modifiedHtml = await applyPromptChanges(htmlContent, userPrompt)
    } else {
      // Has field values (initial personalization or with prompt)
      modifiedHtml = await applyFieldValues(htmlContent, safeFields, safeValues, userPrompt)
    }

    // If AI returned empty or very short response, return original HTML
    if (!modifiedHtml || modifiedHtml.length < 50) {
      console.warn('AI returned empty or too short response, using original HTML')
      return NextResponse.json({ html: htmlContent })
    }

    return NextResponse.json({ html: modifiedHtml })
  } catch (error) {
    console.error('AI customization error:', error)
    return NextResponse.json(
      { error: 'Failed to customize template' },
      { status: 500 }
    )
  }
}
