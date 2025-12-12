'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { TemplateWithFields } from '@/types'
import { CustomizationForm } from '@/components/customization'
import { Spinner } from '@/components/ui/spinner'
import { AiLoader } from '@/components/ui/ai-loader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { User } from 'lucide-react'

interface CustomizePageProps {
  params: Promise<{ id: string }>
}

interface ProfileField {
  id: string
  field_key: string
  label: string
  field_type: string
}

interface ProfileData {
  profile: {
    profile_completed: boolean
    full_name: string | null
  }
  fields: ProfileField[]
  valuesByKey: Record<string, string>
}

export default function CustomizePage({ params }: CustomizePageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [template, setTemplate] = useState<TemplateWithFields | null>(null)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsProfile, setNeedsProfile] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch both template and profile in parallel
        const [templateResponse, profileResponse] = await Promise.all([
          fetch(`/api/templates/${id}`),
          fetch('/api/profile'),
        ])

        const templateResult = await templateResponse.json()
        const profileResult = await profileResponse.json()

        if (!templateResponse.ok) {
          throw new Error(templateResult.error || 'Failed to load template')
        }

        if (!templateResult.data.is_active) {
          throw new Error('This template is not available')
        }

        const templateData = templateResult.data as TemplateWithFields

        // Check if profile is completed
        if (profileResponse.ok && profileResult.data) {
          const profile = profileResult.data as ProfileData
          setProfileData(profile)

          if (!profile.profile?.profile_completed) {
            setNeedsProfile(true)
            setTemplate(templateData)
            setIsLoading(false)
            return
          }

          // Profile is completed - generate AI-customized version before showing
          const hasProfileValues = Object.values(profile.valuesByKey || {}).some(v => v && v.trim())

          if (hasProfileValues) {
            setIsLoading(false)
            setIsGenerating(true)

            try {
              const aiResponse = await fetch('/api/ai/customize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  htmlContent: templateData.html_content,
                  fields: profile.fields?.map(f => ({
                    field_key: f.field_key,
                    label: f.label,
                    field_type: f.field_type,
                  })) || [],
                  values: profile.valuesByKey,
                  userPrompt: 'Apply my profile information to personalize this template',
                }),
              })

              if (aiResponse.ok) {
                const aiResult = await aiResponse.json()
                setGeneratedHtml(aiResult.html)

                // Auto-save the generated customization
                const initialPromptHistory = [{
                  id: `prompt-${Date.now()}`,
                  prompt: 'Apply my profile information to personalize this template',
                  timestamp: new Date().toISOString(),
                  type: 'user' as const
                }, {
                  id: `response-${Date.now() + 1}`,
                  prompt: 'Template updated successfully',
                  timestamp: new Date().toISOString(),
                  type: 'system' as const
                }]

                const initialChangeLog = [{
                  id: `change-${Date.now()}`,
                  description: 'Applied profile information',
                  timestamp: new Date().toISOString()
                }]

                try {
                  const saveResponse = await fetch('/api/customizations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      template_id: templateData.id,
                      name: `My ${templateData.name}`,
                      values: profile.valuesByKey,
                      rendered_html: aiResult.html,
                      prompt_history: initialPromptHistory,
                      change_log: initialChangeLog,
                    }),
                  })

                  if (saveResponse.ok) {
                    const saveResult = await saveResponse.json()
                    // Redirect to the edit page for this saved customization
                    router.replace(`/designs/${saveResult.data.id}`)
                    return
                  }
                } catch (saveError) {
                  console.error('Auto-save error:', saveError)
                  // Continue without saving - user can manually save later
                }
              }
            } catch (aiError) {
              console.error('AI generation error:', aiError)
              // Continue without AI generation - user will see original template
            }

            setIsGenerating(false)
          }

          setTemplate(templateData)
        } else {
          setTemplate(templateData)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (isGenerating) {
    return (
      <div className="fixed inset-0 bg-[#141414] z-50 flex items-center justify-center">
        <AiLoader text="Personalizing" />
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
          onClick={() => router.push('/templates')}
          className="mt-4 text-[#f5d5d5] hover:text-white transition-colors"
        >
          Back to templates
        </button>
      </div>
    )
  }

  // Show profile setup prompt if user hasn't completed their profile
  if (needsProfile) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="w-16 h-16 rounded-full bg-[#f5d5d5]/20 flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-[#f5d5d5]" />
        </div>
        <h1 className="text-2xl font-semibold text-white mb-2">
          Complete Your Profile First
        </h1>
        <p className="text-gray-400 mb-6">
          Before you can create personalized templates, we need some information about you.
          This will be used to automatically customize all your templates.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="primary"
            onClick={() => router.push('/profile')}
          >
            <User className="w-4 h-4 mr-2" />
            Set Up My Profile
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/templates')}
          >
            Back to Templates
          </Button>
        </div>
      </div>
    )
  }

  if (!template) {
    return null
  }

  // Pass profile values as initial values for the customization form
  const initialValues = profileData?.valuesByKey || {}

  // Create profile fields array for the AI to use
  const profileFields = profileData?.fields?.map(f => ({
    field_key: f.field_key,
    label: f.label,
    field_type: f.field_type,
  })) || []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">
          Customize: {template.name}
        </h1>
        <p className="mt-1 text-gray-400">
          {generatedHtml
            ? 'Your profile information has been applied. Make any additional changes below.'
            : 'Customize your template below.'}
        </p>
      </div>

      <CustomizationForm
        template={template}
        initialValues={initialValues}
        profileFields={profileFields}
        initialRenderedHtml={generatedHtml}
        autoGenerate={false}
      />
    </div>
  )
}
