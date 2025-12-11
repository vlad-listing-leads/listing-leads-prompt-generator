'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { TemplateWithFields } from '@/types'
import { CustomizationForm } from '@/components/customization'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface EditPageProps {
  params: Promise<{ id: string }>
}

interface PromptHistoryItem {
  id: string
  prompt: string
  timestamp: string
  type: 'user' | 'system'
}

interface ChangeLogItem {
  id: string
  description: string
  timestamp: string
}

interface CustomizationData {
  id: string
  name: string
  template: TemplateWithFields
  values_map: Record<string, string>
  rendered_html?: string | null
  prompt_history?: PromptHistoryItem[]
  change_log?: ChangeLogItem[]
}

export default function EditPage({ params }: EditPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [customization, setCustomization] = useState<CustomizationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCustomization = async () => {
      try {
        const response = await fetch(`/api/customizations/${id}`)
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to load page')
        }

        setCustomization(result.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchCustomization()
  }, [id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
        <button
          onClick={() => router.push('/my-pages')}
          className="mt-4 text-[#f5d5d5] hover:text-white transition-colors"
        >
          Back to My Pages
        </button>
      </div>
    )
  }

  if (!customization || !customization.template) {
    return null
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">
          Edit: {customization.name}
        </h1>
        <p className="mt-1 text-gray-400">
          Update your personalized page
        </p>
      </div>

      <CustomizationForm
        template={customization.template}
        customizationId={customization.id}
        initialValues={customization.values_map}
        initialName={customization.name}
        initialRenderedHtml={customization.rendered_html}
        initialPromptHistory={customization.prompt_history}
        initialChangeLog={customization.change_log}
      />
    </div>
  )
}
