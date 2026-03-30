'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { TemplateWithFields } from '@/types'
import { TemplateEditor } from '@/components/admin'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface EditTemplatePageProps {
  params: Promise<{ id: string }>
}

export default function EditTemplatePage({ params }: EditTemplatePageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [template, setTemplate] = useState<TemplateWithFields | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const response = await fetch(`/api/templates/${id}`)
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to load template')
        }

        setTemplate(result.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTemplate()
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
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <button
          onClick={() => router.push('/admin/templates')}
          className="mt-4 text-primary hover:text-foreground transition-colors"
        >
          Back to templates
        </button>
      </div>
    )
  }

  if (!template) {
    return null
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Edit Template</h1>
        <p className="mt-1 text-muted-foreground">
          Modify template settings and fields
        </p>
      </div>

      <TemplateEditor template={template} />
    </div>
  )
}
