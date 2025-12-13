'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ImageUploadField } from '@/components/customization/fields/ImageUploadField'
import { ColorPickerField } from '@/components/customization/fields/ColorPickerField'
import { Save, User, Briefcase, Palette, Share2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfileField {
  id: string
  field_key: string
  field_type: string
  label: string
  placeholder?: string
  default_value?: string
  is_required: boolean
  display_order: number
  category: string
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  contact: <User className="w-5 h-5" />,
  business: <Briefcase className="w-5 h-5" />,
  branding: <Palette className="w-5 h-5" />,
  social: <Share2 className="w-5 h-5" />,
  general: <User className="w-5 h-5" />,
}

const CATEGORY_LABELS: Record<string, string> = {
  contact: 'Contact Information',
  business: 'Business Details',
  branding: 'Branding',
  social: 'Social & Web Links',
  general: 'General',
}

// Define category order for navigation
const CATEGORY_ORDER = ['contact', 'business', 'branding', 'social']

export default function ProfilePage() {
  const [fields, setFields] = useState<ProfileField[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [profileCompleted, setProfileCompleted] = useState(false)
  const [activeSection, setActiveSection] = useState<string>('contact')
  const [hasSystemPrompt, setHasSystemPrompt] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch profile first
        const profileResponse = await fetch('/api/profile')
        const profileResult = await profileResponse.json()

        if (!profileResponse.ok) {
          throw new Error(profileResult.error || 'Failed to load profile')
        }

        setFields(profileResult.data.fields || [])
        setValues(profileResult.data.valuesByKey || {})
        setProfileCompleted(profileResult.data.profile?.profile_completed || false)

        // Check if user is admin
        const userIsAdmin = profileResult.data.profile?.role === 'admin'
        setIsAdmin(userIsAdmin)

        // Only fetch settings if user is admin
        if (userIsAdmin) {
          try {
            const settingsResponse = await fetch('/api/settings')
            if (settingsResponse.ok) {
              const settingsResult = await settingsResponse.json()
              const systemPrompt = settingsResult.data?.value?.systemPrompt || ''
              setHasSystemPrompt(systemPrompt.trim().length > 0)
            }
          } catch {
            // Settings fetch failed, ignore
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150 // Offset for header

      for (const category of CATEGORY_ORDER) {
        const ref = sectionRefs.current[category]
        if (ref) {
          const { offsetTop, offsetHeight } = ref
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(category)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (category: string) => {
    const ref = sectionRefs.current[category]
    if (ref) {
      const yOffset = -100 // Offset for sticky header
      const y = ref.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: 'smooth' })
      setActiveSection(category)
    }
  }

  const handleFieldChange = useCallback((fieldKey: string, value: string) => {
    setValues(prev => ({ ...prev, [fieldKey]: value }))
    setSaveSuccess(false)
  }, [])

  const handleSave = async (markComplete = false) => {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          values,
          markComplete,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save profile')
      }

      setSaveSuccess(true)
      if (markComplete) {
        setProfileCompleted(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  // Group fields by category
  const fieldsByCategory = fields.reduce((acc, field) => {
    const category = field.category || 'general'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(field)
    return acc
  }, {} as Record<string, ProfileField[]>)

  const renderField = (field: ProfileField) => {
    const value = values[field.field_key] || ''

    switch (field.field_type) {
      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
            placeholder={field.placeholder || ''}
            rows={3}
          />
        )
      case 'image':
        // Determine preview size based on field key
        const isHeadshot = field.field_key.toLowerCase().includes('headshot')
        const isLogo = field.field_key.toLowerCase().includes('logo')
        const previewSize = isHeadshot
          ? { width: 80, height: 80 }
          : isLogo
          ? { width: 160, height: 80 }
          : 'default' as const

        return (
          <ImageUploadField
            field={{
              id: field.id,
              template_id: '',
              field_key: field.field_key,
              field_type: 'image',
              label: field.label,
              placeholder: field.placeholder || '',
              default_value: field.default_value || '',
              is_required: field.is_required,
              display_order: field.display_order,
              options: null,
              created_at: '',
              updated_at: '',
            }}
            value={value}
            onChange={(val) => handleFieldChange(field.field_key, val)}
            uploadOnly={isHeadshot || isLogo}
            previewSize={previewSize}
          />
        )
      case 'color':
        return (
          <ColorPickerField
            field={{
              id: field.id,
              template_id: '',
              field_key: field.field_key,
              field_type: 'color',
              label: field.label,
              placeholder: field.placeholder || '',
              default_value: field.default_value || '',
              is_required: field.is_required,
              display_order: field.display_order,
              options: null,
              created_at: '',
              updated_at: '',
            }}
            value={value || '#f5d5d5'}
            onChange={(val) => handleFieldChange(field.field_key, val)}
          />
        )
      case 'email':
        return (
          <Input
            type="email"
            value={value}
            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
            placeholder={field.placeholder || ''}
          />
        )
      case 'phone':
        return (
          <Input
            type="tel"
            value={value}
            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
            placeholder={field.placeholder || ''}
          />
        )
      case 'url':
        return (
          <Input
            type="url"
            value={value}
            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
            placeholder={field.placeholder || ''}
          />
        )
      default:
        return (
          <Input
            value={value}
            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
            placeholder={field.placeholder || ''}
          />
        )
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  // Get sorted categories that exist in the data
  const availableCategories = CATEGORY_ORDER.filter(cat => fieldsByCategory[cat]?.length > 0)

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">My Profile</h1>
            {/* AI Status Badge - Admin only */}
            {isAdmin && hasSystemPrompt && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-green-400" />
                <span className="text-xs text-green-400 font-medium">System prompt included</span>
              </span>
            )}
          </div>
          <p className="mt-1 text-gray-400">
            {profileCompleted
              ? 'Your information will be used to personalize all your templates'
              : 'Complete your profile to auto-personalize templates'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-sm text-green-400">Saved!</span>
          )}
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={isSaving}
          >
            {isSaving ? <Spinner size="sm" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
          {!profileCompleted && (
            <Button
              variant="primary"
              onClick={() => handleSave(true)}
              disabled={isSaving}
            >
              Save & Complete Setup
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-8">
        {/* Left Navigation */}
        <nav className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-24 space-y-1">
            {availableCategories.map((category) => (
              <button
                key={category}
                onClick={() => scrollToSection(category)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors",
                  activeSection === category
                    ? "bg-[#f5d5d5]/10 text-[#f5d5d5] border border-[#f5d5d5]/20"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                {CATEGORY_ICONS[category] || CATEGORY_ICONS.general}
                <span className="text-sm font-medium">
                  {CATEGORY_LABELS[category] || category}
                </span>
              </button>
            ))}
          </div>
        </nav>

        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {availableCategories.map((category) => {
            const categoryFields = fieldsByCategory[category] || []
            return (
              <div
                key={category}
                ref={(el) => { sectionRefs.current[category] = el }}
                id={`section-${category}`}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {CATEGORY_ICONS[category] || CATEGORY_ICONS.general}
                      {CATEGORY_LABELS[category] || category}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {categoryFields.map((field) => (
                        <div
                          key={field.id}
                          className={field.field_type === 'textarea' || field.field_type === 'image' ? 'md:col-span-2' : ''}
                        >
                          {/* Image and color fields render their own labels */}
                          {field.field_type !== 'image' && field.field_type !== 'color' && (
                            <div>
                              <Label htmlFor={field.field_key} required={field.is_required}>
                                {field.label}
                              </Label>
                              {field.field_key === 'brokerage' && (
                                <p className="text-xs text-gray-500 mt-0.5">If you&apos;re a solo agent, just leave this empty</p>
                              )}
                            </div>
                          )}
                          <div className={field.field_type !== 'image' && field.field_type !== 'color' ? 'mt-1' : ''}>
                            {renderField(field)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          })}

          <div className="flex justify-end gap-2 pb-8">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={isSaving}
            >
              {isSaving ? <Spinner size="sm" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
            {!profileCompleted && (
              <Button
                variant="primary"
                onClick={() => handleSave(true)}
                disabled={isSaving}
              >
                Save & Complete Setup
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
