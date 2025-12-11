import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

// Lazy initialization
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

// Stream from Anthropic using Haiku
async function* streamAnthropic(prompt: string): AsyncGenerator<string> {
  const stream = getAnthropicClient().messages.stream({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  })

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text
    }
  }
}

// Stream from OpenAI using GPT-4o-mini
async function* streamOpenAI(prompt: string): AsyncGenerator<string> {
  const stream = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  })

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content
    if (content) {
      yield content
    }
  }
}

// Clean up markdown code blocks
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

export async function POST(request: NextRequest) {
  try {
    const { htmlContent, userPrompt } = await request.json()

    if (!htmlContent || !userPrompt) {
      return new Response(JSON.stringify({ error: 'HTML content and prompt are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const provider = await getAIProvider()

    const prompt = `You are an HTML editor. Your ONLY job is to output modified HTML code.

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

    // Create a TransformStream to process the response
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = ''

        try {
          const generator = provider === 'openai'
            ? streamOpenAI(prompt)
            : streamAnthropic(prompt)

          for await (const chunk of generator) {
            fullResponse += chunk
            // Send chunk to client
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`))
          }

          // Clean and send final result
          const cleanedHtml = cleanHtmlResponse(fullResponse)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, html: cleanedHtml })}\n\n`))
          controller.close()
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
