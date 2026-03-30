'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { TemplateWithFields } from '@/types'
import { PromptGenerator } from '@/components/customization/PromptGenerator'
import { Spinner } from '@/components/ui/spinner'
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
  category?: string
  placeholder?: string
  is_required: boolean
  display_order: number
}

interface ProfileData {
  profile: {
    profile_completed: boolean
    first_name: string | null
    last_name: string | null
  }
  fields: ProfileField[]
  valuesByKey: Record<string, string>
}

export default function CustomizePage({ params }: CustomizePageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [template, setTemplate] = useState<TemplateWithFields | null>(null)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
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
        }

        setTemplate(templateData)
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

  if (error) {
    return (
      <div className="max-w-lg mx-auto">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <button
          onClick={() => router.push('/templates')}
          className="mt-4 text-primary hover:text-primary/80 transition-colors"
        >
          Back to designs
        </button>
      </div>
    )
  }

  // Show profile setup prompt if user hasn't completed their profile
  if (needsProfile) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">Complete Your Profile First</h1>
        <p className="text-muted-foreground mb-6">
          Before you can generate prompts, we need some information about you. This will be used to personalize your
          templates.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => router.push('/profile')}>
            <User className="w-4 h-4 mr-2" />
            Set Up My Profile
          </Button>
          <Button variant="outline" onClick={() => router.push('/templates')}>
            Back to Designs
          </Button>
        </div>
      </div>
    )
  }

  if (!template) {
    return null
  }

  return (
    <PromptGenerator
      template={template}
      profileFields={profileData?.fields || []}
      profileValues={profileData?.valuesByKey || {}}
    />
  )
}
