import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

// Lazy initialization to avoid build errors when env vars are missing
let anthropicClient: Anthropic | null = null
let openaiClient: OpenAI | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return anthropicClient
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient
}

type AIProvider = 'anthropic' | 'openai'

async function getAIProvider(): Promise<AIProvider> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_provider')
      .single()

    return data?.value?.provider || 'anthropic'
  } catch {
    return 'anthropic'
  }
}

// Extract media type from base64 data URL
function getMediaType(base64: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  if (base64.startsWith('data:image/png')) return 'image/png'
  if (base64.startsWith('data:image/gif')) return 'image/gif'
  if (base64.startsWith('data:image/webp')) return 'image/webp'
  return 'image/jpeg'
}

// Extract base64 data from data URL
function extractBase64(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/)
  return match ? match[1] : dataUrl
}

// Call Anthropic API with optional image
// Uses Haiku for text-only (fast), Sonnet for images (vision capability)
async function callAnthropic(prompt: string, image?: string | null): Promise<string> {
  // If no image, use Haiku for speed
  if (!image) {
    const message = await getAnthropicClient().messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseContent = message.content[0]
    if (responseContent.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic')
    }

    return responseContent.text.trim()
  }

  // With image, use Sonnet for vision capability
  type ImageBlock = { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string } }
  type TextBlock = { type: 'text'; text: string }
  type ContentBlock = ImageBlock | TextBlock

  const content: ContentBlock[] = [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: getMediaType(image),
        data: extractBase64(image),
      },
    },
    { type: 'text', text: prompt }
  ]

  const message = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content }],
  })

  const responseContent = message.content[0]
  if (responseContent.type !== 'text') {
    throw new Error('Unexpected response type from Anthropic')
  }

  return responseContent.text.trim()
}

// Call OpenAI API with optional image
// Uses GPT-4o-mini for text-only (fast), GPT-4o for images (vision capability)
async function callOpenAI(prompt: string, image?: string | null): Promise<string> {
  // If no image, use GPT-4o-mini for speed
  if (!image) {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseContent = response.choices[0]?.message?.content
    if (!responseContent) {
      throw new Error('No response from OpenAI')
    }

    return responseContent.trim()
  }

  // With image, use GPT-4o for vision capability
  type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

  const content: ContentPart[] = [
    {
      type: 'image_url',
      image_url: { url: image }, // OpenAI accepts data URLs directly
    },
    { type: 'text', text: prompt }
  ]

  const response = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 8000,
    messages: [{ role: 'user', content }],
  })

  const responseContent = response.choices[0]?.message?.content
  if (!responseContent) {
    throw new Error('No response from OpenAI')
  }

  return responseContent.trim()
}

// Generic AI call that routes to the selected provider
async function callAI(prompt: string, provider: AIProvider, image?: string | null): Promise<string> {
  if (provider === 'openai') {
    return callOpenAI(prompt, image)
  }
  return callAnthropic(prompt, image)
}

// Clean up markdown code blocks from response
function cleanHtmlResponse(html: string): string {
  let cleaned = html.trim()

  if (cleaned.startsWith('```html')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }

  return cleaned.trim()
}

// For prompt-only changes (with optional image reference)
async function applyPromptChanges(htmlContent: string, userPrompt: string, provider: AIProvider, image?: string): Promise<string> {
  let prompt: string

  if (image) {
    prompt = `You are an HTML editor. Your ONLY job is to output modified HTML code.

Look at the attached image and apply these instructions.

TASK: ${userPrompt || 'Use this image as reference for styling or content changes'}

INPUT HTML:
${htmlContent}

OUTPUT RULES:
- Output the COMPLETE modified HTML document
- Start with <!DOCTYPE html> or <html> or the first HTML tag
- Do NOT explain what you changed
- Do NOT ask questions
- Do NOT use markdown code blocks
- ONLY output raw HTML code

OUTPUT:`
  } else {
    prompt = `You are an HTML editor. Your ONLY job is to output modified HTML code.

TASK: ${userPrompt}

INPUT HTML:
${htmlContent}

OUTPUT RULES:
- Output the COMPLETE modified HTML document
- Start with <!DOCTYPE html> or <html> or the first HTML tag
- Do NOT explain what you changed
- Do NOT ask questions
- Do NOT use markdown code blocks
- ONLY output raw HTML code

OUTPUT:`
  }

  const response = await callAI(prompt, provider, image)
  return cleanHtmlResponse(response)
}

// For initial personalization with field values
async function applyFieldValues(
  htmlContent: string,
  fields: Array<{field_key: string; label: string; field_type: string}>,
  values: Record<string, string>,
  userPrompt: string | undefined,
  provider: AIProvider
): Promise<string> {
  const fieldDescriptions = fields
    .map((f) => {
      const value = values[f.field_key]
      if (!value) return null
      return `- ${f.label}: "${value}"`
    })
    .filter(Boolean)
    .join('\n')

  let prompt = `You are an HTML editor. Your ONLY job is to output modified HTML code.

TASK: Replace placeholder content with these values:
${fieldDescriptions}
${userPrompt ? `\nAdditional: ${userPrompt}` : ''}

INPUT HTML:
${htmlContent}

REPLACEMENT RULES:
- Names go in name/contact sections
- Phone numbers replace phone placeholders
- Emails replace email placeholders
- Colors apply to CSS styles

OUTPUT RULES:
- Output the COMPLETE modified HTML document
- Start with <!DOCTYPE html> or <html> or the first HTML tag
- Do NOT explain what you changed
- Do NOT ask questions
- Do NOT use markdown code blocks
- ONLY output raw HTML code

OUTPUT:`

  const response = await callAI(prompt, provider)
  return cleanHtmlResponse(response)
}

export async function POST(request: NextRequest) {
  try {
    const { htmlContent, fields, values, userPrompt, image } = await request.json()

    if (!htmlContent) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 })
    }

    // Get the configured AI provider
    const provider = await getAIProvider()

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

    if (!hasFieldValues && !userPrompt && !image) {
      return NextResponse.json({ html: htmlContent })
    }

    let modifiedHtml: string

    if ((userPrompt || image) && !hasFieldValues) {
      modifiedHtml = await applyPromptChanges(htmlContent, userPrompt || '', provider, image)
    } else {
      modifiedHtml = await applyFieldValues(htmlContent, safeFields, safeValues, userPrompt, provider)
    }

    if (!modifiedHtml || modifiedHtml.length < 50) {
      console.warn('AI returned empty or too short response, using original HTML')
      return NextResponse.json({ html: htmlContent })
    }

    return NextResponse.json({ html: modifiedHtml })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''
    console.error('AI customization error:', errorMessage)
    console.error('Error stack:', errorStack)
    return NextResponse.json(
      { error: `Failed to customize template: ${errorMessage}` },
      { status: 500 }
    )
  }
}
