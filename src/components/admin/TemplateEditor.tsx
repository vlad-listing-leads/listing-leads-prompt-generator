'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TemplateWithFields, TemplateField, FieldType, Campaign } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { extractPlaceholders } from '@/lib/template-renderer'
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  X,
} from 'lucide-react'

interface FieldConfig {
  id?: string
  field_key: string
  field_type: FieldType
  label: string
  placeholder: string
  default_value: string
  is_required: boolean
  display_order: number
  options: { label: string; value: string }[]
}

interface TemplateEditorProps {
  template?: TemplateWithFields
  isNew?: boolean
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'select', label: 'Select' },
  { value: 'image', label: 'Image' },
  { value: 'color', label: 'Color' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
]

export function TemplateEditor({ template, isNew = false }: TemplateEditorProps) {
  const router = useRouter()

  // Form state
  const [name, setName] = useState(template?.name || '')
  const [description, setDescription] = useState(template?.description || '')
  const [htmlContent, setHtmlContent] = useState(template?.html_content || '')
  const [thumbnailUrl, setThumbnailUrl] = useState(template?.thumbnail_url || '')
  const [isActive, setIsActive] = useState(template?.is_active ?? true)
  const [campaignId, setCampaignId] = useState<string | null>((template as TemplateWithFields & { campaign_id?: string })?.campaign_id || null)
  const [fields, setFields] = useState<FieldConfig[]>(() => {
    if (template?.template_fields) {
      return template.template_fields.map((f: TemplateField) => ({
        id: f.id,
        field_key: f.field_key,
        field_type: f.field_type,
        label: f.label,
        placeholder: f.placeholder || '',
        default_value: f.default_value || '',
        is_required: f.is_required,
        display_order: f.display_order,
        options: (f.options as { label: string; value: string }[]) || [],
      }))
    }
    return []
  })

  // Campaign state
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false)
  const [showNewCampaignForm, setShowNewCampaignForm] = useState(false)
  const [newCampaignName, setNewCampaignName] = useState('')
  const [newCampaignColor, setNewCampaignColor] = useState('#f5d5d5')
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false)

  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedField, setExpandedField] = useState<number | null>(null)
  const [detectedPlaceholders, setDetectedPlaceholders] = useState<string[]>([])

  // Detect placeholders in HTML
  useEffect(() => {
    const placeholders = extractPlaceholders(htmlContent)
    setDetectedPlaceholders(placeholders)
  }, [htmlContent])

  // Fetch campaigns on mount
  useEffect(() => {
    const fetchCampaigns = async () => {
      setIsLoadingCampaigns(true)
      try {
        const response = await fetch('/api/campaigns')
        const result = await response.json()
        if (response.ok) {
          setCampaigns(result.data || [])
        }
      } catch (err) {
        console.error('Error fetching campaigns:', err)
      } finally {
        setIsLoadingCampaigns(false)
      }
    }
    fetchCampaigns()
  }, [])

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return

    setIsCreatingCampaign(true)
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCampaignName,
          color: newCampaignColor,
        }),
      })

      const result = await response.json()
      if (response.ok) {
        setCampaigns([result.data, ...campaigns])
        setCampaignId(result.data.id)
        setNewCampaignName('')
        setNewCampaignColor('#f5d5d5')
        setShowNewCampaignForm(false)
      }
    } catch (err) {
      console.error('Error creating campaign:', err)
    } finally {
      setIsCreatingCampaign(false)
    }
  }

  const addField = (fieldKey?: string) => {
    const newField: FieldConfig = {
      field_key: fieldKey || `field_${fields.length + 1}`,
      field_type: 'text',
      label: fieldKey ? fieldKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : 'New Field',
      placeholder: '',
      default_value: '',
      is_required: false,
      display_order: fields.length,
      options: [],
    }
    setFields([...fields, newField])
    setExpandedField(fields.length)
  }

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index))
    if (expandedField === index) {
      setExpandedField(null)
    }
  }

  const updateField = (index: number, updates: Partial<FieldConfig>) => {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...updates } : f)))
  }

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= fields.length) return

    const newFields = [...fields]
    const [removed] = newFields.splice(index, 1)
    newFields.splice(newIndex, 0, removed)
    newFields.forEach((f, i) => (f.display_order = i))
    setFields(newFields)
  }

  const addOption = (fieldIndex: number) => {
    const field = fields[fieldIndex]
    updateField(fieldIndex, {
      options: [...field.options, { label: '', value: '' }],
    })
  }

  const updateOption = (
    fieldIndex: number,
    optionIndex: number,
    updates: { label?: string; value?: string }
  ) => {
    const field = fields[fieldIndex]
    const newOptions = field.options.map((opt, i) =>
      i === optionIndex ? { ...opt, ...updates } : opt
    )
    updateField(fieldIndex, { options: newOptions })
  }

  const removeOption = (fieldIndex: number, optionIndex: number) => {
    const field = fields[fieldIndex]
    updateField(fieldIndex, {
      options: field.options.filter((_, i) => i !== optionIndex),
    })
  }

  const autoGenerateFields = () => {
    const existingKeys = new Set(fields.map((f) => f.field_key))
    const newFields: FieldConfig[] = []

    detectedPlaceholders.forEach((placeholder) => {
      if (!existingKeys.has(placeholder)) {
        newFields.push({
          field_key: placeholder,
          field_type: guessFieldType(placeholder),
          label: placeholder.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          placeholder: '',
          default_value: '',
          is_required: false,
          display_order: fields.length + newFields.length,
          options: [],
        })
      }
    })

    if (newFields.length > 0) {
      setFields([...fields, ...newFields])
    }
  }

  const guessFieldType = (key: string): FieldType => {
    const lowerKey = key.toLowerCase()
    if (lowerKey.includes('email')) return 'email'
    if (lowerKey.includes('phone') || lowerKey.includes('tel')) return 'phone'
    if (lowerKey.includes('url') || lowerKey.includes('link') || lowerKey.includes('website')) return 'url'
    if (lowerKey.includes('image') || lowerKey.includes('photo') || lowerKey.includes('picture')) return 'image'
    if (lowerKey.includes('color') || lowerKey.includes('colour')) return 'color'
    if (lowerKey.includes('description') || lowerKey.includes('bio') || lowerKey.includes('about')) return 'textarea'
    return 'text'
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Template name is required')
      return
    }
    if (!htmlContent.trim()) {
      setError('HTML content is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const url = isNew ? '/api/templates' : `/api/templates/${template?.id}`
      const method = isNew ? 'POST' : 'PUT'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          html_content: htmlContent,
          thumbnail_url: thumbnailUrl || null,
          is_active: isActive,
          campaign_id: campaignId,
          fields: fields.map((f, i) => ({
            ...f,
            display_order: i,
            options: f.options.length > 0 ? f.options : null,
          })),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save template')
      }

      router.push('/admin/templates')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setIsSaving(false)
    }
  }

  // Find missing fields (placeholders without corresponding field definitions)
  const missingFields = detectedPlaceholders.filter(
    (p) => !fields.some((f) => f.field_key === p)
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/admin/templates')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Templates
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Template
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" required>
                Template Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Real Estate Listing - Modern"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of this template..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="thumbnailUrl">Thumbnail URL</Label>
              <Input
                id="thumbnailUrl"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://example.com/thumbnail.jpg"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-white/10 bg-[#2a2a2a] text-[#f5d5d5] focus:ring-[#f5d5d5]/50"
              />
              <Label htmlFor="isActive">Active (visible to users)</Label>
            </div>

            {/* Campaign Selection */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <Label>Campaign</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewCampaignForm(!showNewCampaignForm)}
                  className="h-7 px-2 text-xs"
                >
                  {showNewCampaignForm ? (
                    <>
                      <X className="w-3 h-3 mr-1" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <FolderPlus className="w-3 h-3 mr-1" />
                      New Campaign
                    </>
                  )}
                </Button>
              </div>

              {showNewCampaignForm && (
                <div className="p-3 bg-[#2a2a2a] rounded-lg border border-white/5 space-y-3">
                  <div className="space-y-2">
                    <Label>Campaign Name</Label>
                    <Input
                      value={newCampaignName}
                      onChange={(e) => setNewCampaignName(e.target.value)}
                      placeholder="e.g., Spring 2025 Listings"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newCampaignColor}
                        onChange={(e) => setNewCampaignColor(e.target.value)}
                        className="w-10 h-10 rounded border border-white/10 bg-transparent cursor-pointer"
                      />
                      <Input
                        value={newCampaignColor}
                        onChange={(e) => setNewCampaignColor(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCreateCampaign}
                    disabled={!newCampaignName.trim() || isCreatingCampaign}
                    className="w-full"
                  >
                    {isCreatingCampaign ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Creating...
                      </>
                    ) : (
                      'Create Campaign'
                    )}
                  </Button>
                </div>
              )}

              {isLoadingCampaigns ? (
                <div className="flex items-center justify-center py-4">
                  <Spinner size="sm" />
                </div>
              ) : (
                <Select
                  value={campaignId || ''}
                  onChange={(e) => setCampaignId(e.target.value || null)}
                >
                  <option value="">No campaign</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </Select>
              )}

              {campaignId && campaigns.find((c) => c.id === campaignId) && (
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: campaigns.find((c) => c.id === campaignId)?.color }}
                  />
                  <span className="text-gray-400">
                    {campaigns.find((c) => c.id === campaignId)?.name}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* HTML Content */}
        <Card>
          <CardHeader>
            <CardTitle>HTML Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="htmlContent" required>
                Template HTML
              </Label>
              <p className="text-sm text-gray-400">
                Use {"{{field_key}}"} placeholders for dynamic content
              </p>
              <Textarea
                id="htmlContent"
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                placeholder="<!DOCTYPE html>..."
                rows={15}
                className="font-mono text-sm"
              />
            </div>

            {detectedPlaceholders.length > 0 && (
              <div className="p-3 bg-[#2a2a2a] rounded-xl border border-white/5">
                <p className="text-sm font-medium mb-2 text-gray-300">
                  Detected Placeholders ({detectedPlaceholders.length}):
                </p>
                <div className="flex flex-wrap gap-1">
                  {detectedPlaceholders.map((p) => (
                    <code
                      key={p}
                      className={`px-2 py-0.5 rounded text-xs ${
                        missingFields.includes(p)
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          : 'bg-green-500/20 text-green-400 border border-green-500/30'
                      }`}
                    >
                      {p}
                    </code>
                  ))}
                </div>
                {missingFields.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={autoGenerateFields}
                  >
                    Auto-generate missing fields
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fields */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Template Fields ({fields.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={() => addField()}>
            <Plus className="w-4 h-4 mr-1" />
            Add Field
          </Button>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No fields defined yet.</p>
              {detectedPlaceholders.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={autoGenerateFields}
                >
                  Auto-generate from placeholders
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={index}
                  className="border border-white/10 rounded-xl overflow-hidden"
                >
                  {/* Field Header */}
                  <div
                    className="flex items-center gap-2 px-4 py-3 bg-[#2a2a2a] cursor-pointer hover:bg-[#333] transition-colors"
                    onClick={() =>
                      setExpandedField(expandedField === index ? null : index)
                    }
                  >
                    <GripVertical className="w-4 h-4 text-gray-500" />
                    <div className="flex-1">
                      <span className="font-medium text-white">{field.label}</span>
                      <code className="ml-2 text-sm text-gray-500">
                        {field.field_key}
                      </code>
                    </div>
                    <span className="text-sm text-gray-400 capitalize">
                      {field.field_type}
                    </span>
                    {field.is_required && (
                      <span className="text-xs text-[#f5d5d5]">Required</span>
                    )}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          moveField(index, 'up')
                        }}
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          moveField(index, 'down')
                        }}
                        disabled={index === fields.length - 1}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeField(index)
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  {/* Field Details */}
                  {expandedField === index && (
                    <div className="p-4 space-y-4 border-t border-white/10 bg-[#1a1a1a]">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Field Key</Label>
                          <Input
                            value={field.field_key}
                            onChange={(e) =>
                              updateField(index, {
                                field_key: e.target.value.replace(/\s/g, '_'),
                              })
                            }
                            placeholder="field_key"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Field Type</Label>
                          <Select
                            value={field.field_type}
                            onChange={(e) =>
                              updateField(index, {
                                field_type: e.target.value as FieldType,
                              })
                            }
                          >
                            {FIELD_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Label</Label>
                          <Input
                            value={field.label}
                            onChange={(e) =>
                              updateField(index, { label: e.target.value })
                            }
                            placeholder="Display label"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Placeholder</Label>
                          <Input
                            value={field.placeholder}
                            onChange={(e) =>
                              updateField(index, { placeholder: e.target.value })
                            }
                            placeholder="Placeholder text"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Default Value</Label>
                          <Input
                            value={field.default_value}
                            onChange={(e) =>
                              updateField(index, { default_value: e.target.value })
                            }
                            placeholder="Default value"
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-8">
                          <input
                            type="checkbox"
                            id={`required-${index}`}
                            checked={field.is_required}
                            onChange={(e) =>
                              updateField(index, { is_required: e.target.checked })
                            }
                            className="rounded border-white/10 bg-[#2a2a2a] text-[#f5d5d5] focus:ring-[#f5d5d5]/50"
                          />
                          <Label htmlFor={`required-${index}`}>Required</Label>
                        </div>
                      </div>

                      {/* Options for Select fields */}
                      {field.field_type === 'select' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Options</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addOption(index)}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add Option
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {field.options.map((option, optIndex) => (
                              <div key={optIndex} className="flex items-center gap-2">
                                <Input
                                  value={option.label}
                                  onChange={(e) =>
                                    updateOption(index, optIndex, {
                                      label: e.target.value,
                                    })
                                  }
                                  placeholder="Label"
                                  className="flex-1"
                                />
                                <Input
                                  value={option.value}
                                  onChange={(e) =>
                                    updateOption(index, optIndex, {
                                      value: e.target.value,
                                    })
                                  }
                                  placeholder="Value"
                                  className="flex-1"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeOption(index, optIndex)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
