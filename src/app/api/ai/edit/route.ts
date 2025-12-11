import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

// Lazy initialization
let anthropicClient: Anthropic | null = null
let openaiClient: OpenAI | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return anthropicClient
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
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

// Tool definitions
const tools = [
  {
    name: 'replace_text',
    description: 'Replace text content in the HTML. Use this to change names, phone numbers, emails, addresses, headings, paragraphs, or any visible text.',
    input_schema: {
      type: 'object' as const,
      properties: {
        find: { type: 'string', description: 'The exact text to find (case-sensitive)' },
        replace: { type: 'string', description: 'The text to replace it with' },
        all: { type: 'boolean', description: 'Replace all occurrences (default: true)' }
      },
      required: ['find', 'replace']
    }
  },
  {
    name: 'change_color',
    description: 'Change a color in the CSS styles. Use this to modify background colors, text colors, border colors, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        target: { type: 'string', description: 'Description of what color to change (e.g., "background", "header background", "primary text color", "button color")' },
        old_color: { type: 'string', description: 'The current color value (hex, rgb, or color name) - look for it in the HTML/CSS' },
        new_color: { type: 'string', description: 'The new color value (hex format preferred, e.g., #ff5500)' }
      },
      required: ['target', 'new_color']
    }
  },
  {
    name: 'change_style',
    description: 'Change a CSS style property value. Use for font sizes, margins, padding, widths, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector_hint: { type: 'string', description: 'Description of the element (e.g., "main heading", "body text", "container")' },
        property: { type: 'string', description: 'CSS property name (e.g., font-size, margin, padding, width)' },
        old_value: { type: 'string', description: 'Current value to find' },
        new_value: { type: 'string', description: 'New value to set' }
      },
      required: ['property', 'new_value']
    }
  },
  {
    name: 'change_image',
    description: 'Change an image URL/source in the HTML.',
    input_schema: {
      type: 'object' as const,
      properties: {
        old_src: { type: 'string', description: 'Current image URL or filename to find' },
        new_src: { type: 'string', description: 'New image URL' }
      },
      required: ['old_src', 'new_src']
    }
  },
  {
    name: 'change_link',
    description: 'Change a link URL (href) in the HTML.',
    input_schema: {
      type: 'object' as const,
      properties: {
        old_href: { type: 'string', description: 'Current link URL to find' },
        new_href: { type: 'string', description: 'New link URL' }
      },
      required: ['old_href', 'new_href']
    }
  }
]

// OpenAI tool format
const openaiTools: OpenAI.ChatCompletionTool[] = tools.map(tool => ({
  type: 'function' as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema
  }
}))

// Execute tool calls on HTML
interface ToolCall {
  name: string
  input: Record<string, unknown>
}

function executeTools(html: string, toolCalls: ToolCall[]): string {
  let result = html

  for (const call of toolCalls) {
    switch (call.name) {
      case 'replace_text': {
        const { find, replace, all = true } = call.input as { find: string; replace: string; all?: boolean }
        if (find && replace !== undefined) {
          if (all) {
            result = result.split(find).join(replace)
          } else {
            result = result.replace(find, replace)
          }
        }
        break
      }
      case 'change_color': {
        const { old_color, new_color } = call.input as { old_color?: string; new_color: string; target: string }
        if (old_color && new_color) {
          // Replace the old color with new color
          result = result.split(old_color).join(new_color)
        }
        break
      }
      case 'change_style': {
        const { property, old_value, new_value } = call.input as { property: string; old_value?: string; new_value: string; selector_hint?: string }
        if (property && old_value && new_value) {
          // Find and replace the style value
          const pattern = new RegExp(`(${property}\\s*:\\s*)${old_value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi')
          result = result.replace(pattern, `$1${new_value}`)
        }
        break
      }
      case 'change_image': {
        const { old_src, new_src } = call.input as { old_src: string; new_src: string }
        if (old_src && new_src) {
          result = result.split(old_src).join(new_src)
        }
        break
      }
      case 'change_link': {
        const { old_href, new_href } = call.input as { old_href: string; new_href: string }
        if (old_href && new_href) {
          result = result.split(old_href).join(new_href)
        }
        break
      }
    }
  }

  return result
}

// Call Anthropic with tools
async function callAnthropicWithTools(prompt: string, html: string): Promise<ToolCall[]> {
  const systemPrompt = `You are an HTML editor assistant. Analyze the user's request and use the provided tools to make changes to the HTML.

IMPORTANT RULES:
1. Look at the HTML to find the EXACT text/values to replace
2. For replace_text, use the EXACT text from the HTML (case-sensitive)
3. You can call multiple tools if needed
4. Only make the changes the user requested

HTML to edit:
${html}`

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    tools: tools,
    messages: [{ role: 'user', content: prompt }]
  })

  const toolCalls: ToolCall[] = []

  for (const block of response.content) {
    if (block.type === 'tool_use') {
      toolCalls.push({
        name: block.name,
        input: block.input as Record<string, unknown>
      })
    }
  }

  return toolCalls
}

// Call OpenAI with tools
async function callOpenAIWithTools(prompt: string, html: string): Promise<ToolCall[]> {
  const systemPrompt = `You are an HTML editor assistant. Analyze the user's request and use the provided tools to make changes to the HTML.

IMPORTANT RULES:
1. Look at the HTML to find the EXACT text/values to replace
2. For replace_text, use the EXACT text from the HTML (case-sensitive)
3. You can call multiple tools if needed
4. Only make the changes the user requested

HTML to edit:
${html}`

  const response = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    tools: openaiTools,
    tool_choice: 'auto'
  })

  const toolCalls: ToolCall[] = []
  const message = response.choices[0]?.message

  if (message?.tool_calls) {
    for (const tc of message.tool_calls) {
      if (tc.type === 'function' && 'function' in tc) {
        try {
          const func = tc.function as { name: string; arguments: string }
          toolCalls.push({
            name: func.name,
            input: JSON.parse(func.arguments)
          })
        } catch {
          // Skip malformed tool calls
        }
      }
    }
  }

  return toolCalls
}

export async function POST(request: NextRequest) {
  try {
    const { htmlContent, userPrompt } = await request.json()

    if (!htmlContent || !userPrompt) {
      return NextResponse.json({ error: 'HTML content and prompt are required' }, { status: 400 })
    }

    const provider = await getAIProvider()

    // Get tool calls from AI
    const toolCalls = provider === 'openai'
      ? await callOpenAIWithTools(userPrompt, htmlContent)
      : await callAnthropicWithTools(userPrompt, htmlContent)

    if (toolCalls.length === 0) {
      // No tools called, return original HTML
      return NextResponse.json({
        html: htmlContent,
        changes: [],
        message: 'No changes detected'
      })
    }

    // Execute the tool calls
    const modifiedHtml = executeTools(htmlContent, toolCalls)

    // Return result with info about what changed
    return NextResponse.json({
      html: modifiedHtml,
      changes: toolCalls.map(tc => ({
        tool: tc.name,
        params: tc.input
      }))
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('AI edit error:', errorMessage)
    return NextResponse.json({ error: `Failed to edit: ${errorMessage}` }, { status: 500 })
  }
}
