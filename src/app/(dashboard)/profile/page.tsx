'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ImageUploadField } from '@/components/customization/fields/ImageUploadField'
import { ColorPickerField } from '@/components/customization/fields/ColorPickerField'
import { Save, User, Briefcase, Palette, Share2 } from 'lucide-react'

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

export default function ProfilePage() {
  const router = useRouter()
  const [fields, setFields] = useState<ProfileField[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [profileCompleted, setProfileCompleted] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/profile')
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to load profile')
        }

        setFields(result.data.fields || [])
        setValues(result.data.valuesByKey || {})
        setProfileCompleted(result.data.profile?.profile_completed || false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [])

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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">My Profile</h1>
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

      <div className="space-y-6">
        {Object.entries(fieldsByCategory).map(([category, categoryFields]) => (
          <Card key={category}>
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
                      <Label htmlFor={field.field_key} required={field.is_required}>
                        {field.label}
                      </Label>
                    )}
                    <div className={field.field_type !== 'image' && field.field_type !== 'color' ? 'mt-1' : ''}>
                      {renderField(field)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex justify-end gap-2">
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
  )
}
