'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { TemplateWithFields, Campaign } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft,
  Save,
  FolderPlus,
  X,
  Loader2,
  Upload,
} from 'lucide-react'
import { TemplateFieldsEditor, TemplateFieldData } from './TemplateFieldsEditor'

interface SystemPrompt {
  id: string
  name: string
  description: string | null
  prompt_content: string
  is_active: boolean
}

interface TemplateEditorProps {
  template?: TemplateWithFields
  isNew?: boolean
}

export function TemplateEditor({ template, isNew = false }: TemplateEditorProps) {
  const router = useRouter()

  // Form state
  const [name, setName] = useState(template?.name || '')
  const [description, setDescription] = useState(template?.description || '')
  const [size, setSize] = useState(template?.size || '8.5x11 inches')
  const [htmlContent, setHtmlContent] = useState(template?.html_content || '')
  const [thumbnailUrl, setThumbnailUrl] = useState(template?.thumbnail_url || '')
  const [isActive, setIsActive] = useState(template?.is_active ?? true)
  const [campaignId, setCampaignId] = useState<string | null>((template as TemplateWithFields & { campaign_id?: string })?.campaign_id || null)
  const [systemPromptId, setSystemPromptId] = useState<string | null>((template as TemplateWithFields & { system_prompt_id?: string })?.system_prompt_id || null)
  const [templatePrompt, setTemplatePrompt] = useState((template as TemplateWithFields & { template_prompt?: string })?.template_prompt || '')
  const [artifactUrl, setArtifactUrl] = useState((template as TemplateWithFields & { artifact_url?: string })?.artifact_url || '')
  const [templateFields, setTemplateFields] = useState<TemplateFieldData[]>(() => {
    return (template?.template_fields || []).map((f, i) => ({
      id: f.id,
      field_key: f.field_key,
      field_type: f.field_type as 'text' | 'textarea' | 'select',
      label: f.label,
      placeholder: f.placeholder,
      default_value: f.default_value,
      options: f.options as { label: string; value: string }[] | null,
      is_required: f.is_required,
      display_order: f.display_order ?? i,
    }))
  })

  // Campaign state
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false)

  // System prompts state
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([])
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false)
  const [showNewCampaignForm, setShowNewCampaignForm] = useState(false)
  const [newCampaignName, setNewCampaignName] = useState('')
  const [newCampaignColor, setNewCampaignColor] = useState('#f5d5d5')
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false)
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)
  const [editCampaignName, setEditCampaignName] = useState('')
  const [editCampaignColor, setEditCampaignColor] = useState('')
  const [isSavingCampaign, setIsSavingCampaign] = useState(false)

  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Thumbnail state
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false)
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false)
  const [useCustomThumbnail, setUseCustomThumbnail] = useState(!!template?.thumbnail_url)
  const thumbnailGenerationRef = useRef<NodeJS.Timeout | null>(null)
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null)
  const lastHtmlRef = useRef<string>('')

  // Description generation state
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
  const descriptionGenerationRef = useRef<NodeJS.Timeout | null>(null)
  const lastHtmlForDescRef = useRef<string>('')

  // Fetch campaigns and system prompts on mount
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

    const fetchSystemPrompts = async () => {
      setIsLoadingPrompts(true)
      try {
        const response = await fetch('/api/prompts')
        const result = await response.json()
        if (response.ok) {
          setSystemPrompts(result.data || [])
        }
      } catch (err) {
        console.error('Error fetching system prompts:', err)
      } finally {
        setIsLoadingPrompts(false)
      }
    }

    fetchCampaigns()
    fetchSystemPrompts()
  }, [])

  // Auto-generate thumbnail when HTML content changes
  const generateThumbnail = useCallback(async (html: string) => {
    if (!html.trim() || html === lastHtmlRef.current) return

    lastHtmlRef.current = html
    setIsGeneratingThumbnail(true)
    setError(null)

    try {
      const response = await fetch('/api/thumbnail/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html,
          name: name || 'template',
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate thumbnail')
      }

      setThumbnailUrl(result.url)
    } catch (err) {
      console.error('Thumbnail generation error:', err)
      // Don't show error for auto-generation, just log it
    } finally {
      setIsGeneratingThumbnail(false)
    }
  }, [name])

  // Debounced auto-generation when HTML changes (only if not using custom thumbnail)
  useEffect(() => {
    if (!htmlContent.trim() || useCustomThumbnail) return

    // Clear any pending generation
    if (thumbnailGenerationRef.current) {
      clearTimeout(thumbnailGenerationRef.current)
    }

    // Debounce: wait 1.5 seconds after user stops typing
    thumbnailGenerationRef.current = setTimeout(() => {
      generateThumbnail(htmlContent)
    }, 1500)

    return () => {
      if (thumbnailGenerationRef.current) {
        clearTimeout(thumbnailGenerationRef.current)
      }
    }
  }, [htmlContent, generateThumbnail, useCustomThumbnail])

  // Handle custom thumbnail upload
  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingThumbnail(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', '/thumbnails')

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload thumbnail')
      }

      setThumbnailUrl(result.url)
      setUseCustomThumbnail(true)
    } catch (err) {
      console.error('Thumbnail upload error:', err)
      setError(err instanceof Error ? err.message : 'Failed to upload thumbnail')
    } finally {
      setIsUploadingThumbnail(false)
      // Reset input so same file can be selected again
      if (thumbnailInputRef.current) {
        thumbnailInputRef.current.value = ''
      }
    }
  }

  // Switch to auto-generated thumbnail
  const handleUseAutoThumbnail = () => {
    setUseCustomThumbnail(false)
    lastHtmlRef.current = '' // Reset to trigger regeneration
    if (htmlContent.trim()) {
      generateThumbnail(htmlContent)
    }
  }

  // Auto-generate description when HTML content changes (only if description is empty)
  const generateDescription = useCallback(async (html: string) => {
    if (!html.trim() || html === lastHtmlForDescRef.current) return

    lastHtmlForDescRef.current = html
    setIsGeneratingDescription(true)

    try {
      const response = await fetch('/api/description/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html,
          name: name || '',
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate description')
      }

      setDescription(result.description)
    } catch (err) {
      console.error('Description generation error:', err)
    } finally {
      setIsGeneratingDescription(false)
    }
  }, [name])

  // Debounced description generation when HTML changes (only if description is empty)
  useEffect(() => {
    // Only auto-generate if description is empty
    if (!htmlContent.trim() || description.trim()) return

    // Clear any pending generation
    if (descriptionGenerationRef.current) {
      clearTimeout(descriptionGenerationRef.current)
    }

    // Debounce: wait 2 seconds after user stops typing
    descriptionGenerationRef.current = setTimeout(() => {
      generateDescription(htmlContent)
    }, 2000)

    return () => {
      if (descriptionGenerationRef.current) {
        clearTimeout(descriptionGenerationRef.current)
      }
    }
  }, [htmlContent, description, generateDescription])

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

  const handleStartEditCampaign = (campaign: Campaign) => {
    setEditingCampaignId(campaign.id)
    setEditCampaignName(campaign.name)
    setEditCampaignColor(campaign.color)
    setShowNewCampaignForm(false)
  }

  const handleSaveCampaign = async () => {
    if (!editingCampaignId || !editCampaignName.trim()) return

    setIsSavingCampaign(true)
    try {
      const response = await fetch(`/api/campaigns/${editingCampaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editCampaignName,
          color: editCampaignColor,
        }),
      })

      const result = await response.json()
      if (response.ok) {
        setCampaigns(campaigns.map(c =>
          c.id === editingCampaignId
            ? { ...c, name: editCampaignName, color: editCampaignColor }
            : c
        ))
        setEditingCampaignId(null)
      } else {
        setError(result.error || 'Failed to update campaign')
      }
    } catch (err) {
      console.error('Error updating campaign:', err)
      setError('Failed to update campaign')
    } finally {
      setIsSavingCampaign(false)
    }
  }

  const handleCancelEditCampaign = () => {
    setEditingCampaignId(null)
    setEditCampaignName('')
    setEditCampaignColor('')
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
          size: size || '8.5x11 inches',
          html_content: htmlContent,
          thumbnail_url: thumbnailUrl || null,
          is_active: isActive,
          campaign_id: campaignId,
          system_prompt_id: systemPromptId,
          template_prompt: templatePrompt || null,
          artifact_url: artifactUrl || null,
          fields: templateFields.map((f) => ({
            field_key: f.field_key,
            field_type: f.field_type,
            label: f.label,
            placeholder: f.placeholder || null,
            default_value: f.default_value || null,
            options: f.options,
            is_required: f.is_required,
            display_order: f.display_order,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/admin/templates')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Templates
        </Button>
        <Button variant="default" onClick={handleSave} disabled={isSaving}>
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
              <div className="relative">
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A brief description of this template..."
                  rows={2}
                  disabled={isGeneratingDescription}
                />
                {isGeneratingDescription && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/80 rounded-xl">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Generating...</span>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty and OpenAI will generate a description for you.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="size" required>Print Size</Label>
              <Select
                id="size"
                value={size}
                onChange={(e) => setSize(e.target.value)}
              >
                <option value="8.5x11 inches">8.5 x 11 inches (Letter)</option>
                <option value="8.5x14 inches">8.5 x 14 inches (Legal)</option>
                <option value="11x17 inches">11 x 17 inches (Tabloid)</option>
                <option value="A4">A4 (210 x 297 mm)</option>
                <option value="A5">A5 (148 x 210 mm)</option>
                <option value="5x7 inches">5 x 7 inches</option>
                <option value="4x6 inches">4 x 6 inches (Postcard)</option>
                <option value="6x9 inches">6 x 9 inches</option>
                <option value="9x12 inches">9 x 12 inches</option>
                <option value="custom">Custom (specify in description)</option>
              </Select>
              <p className="text-xs text-muted-foreground">
                This size will be included in the generated prompt to ensure Claude creates content that fits this printable size.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-border bg-background text-primary focus:ring-ring"
              />
              <Label htmlFor="isActive">Active (visible to users)</Label>
            </div>

            {/* Campaign Selection */}
            <div className="space-y-2 pt-2 border-t border-border">
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
                <div className="p-3 bg-muted rounded-lg border border-border space-y-3">
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
                        className="w-10 h-10 rounded border border-border bg-transparent cursor-pointer"
                      />
                      <Input
                        value={newCampaignColor}
                        onChange={(e) => setNewCampaignColor(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <Button
                    variant="default"
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
                editingCampaignId === campaignId ? (
                  <div className="p-3 bg-muted rounded-lg border border-border space-y-3">
                    <div className="space-y-2">
                      <Label>Campaign Name</Label>
                      <Input
                        value={editCampaignName}
                        onChange={(e) => setEditCampaignName(e.target.value)}
                        placeholder="Campaign name"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editCampaignColor}
                          onChange={(e) => setEditCampaignColor(e.target.value)}
                          className="w-10 h-10 rounded border border-border bg-transparent cursor-pointer"
                        />
                        <Input
                          value={editCampaignColor}
                          onChange={(e) => setEditCampaignColor(e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleSaveCampaign}
                        disabled={!editCampaignName.trim() || isSavingCampaign}
                        className="flex-1"
                      >
                        {isSavingCampaign ? (
                          <>
                            <Spinner size="sm" className="mr-2" />
                            Saving...
                          </>
                        ) : (
                          'Save'
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEditCampaign}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const campaign = campaigns.find((c) => c.id === campaignId)
                      if (campaign) handleStartEditCampaign(campaign)
                    }}
                    className="flex items-center gap-2 text-sm group hover:bg-accent -mx-2 px-2 py-1 rounded-lg transition-colors"
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: campaigns.find((c) => c.id === campaignId)?.color }}
                    />
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      {campaigns.find((c) => c.id === campaignId)?.name}
                    </span>
                    <span className="text-muted-foreground/70 text-xs group-hover:text-muted-foreground transition-colors">
                      (click to edit)
                    </span>
                  </button>
                )
              )}
            </div>

            {/* System Prompt Selection */}
            <div className="space-y-2 pt-2 border-t border-border">
              <Label>System Prompt</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Select a system prompt to customize how Claude generates content for this template
              </p>
              {isLoadingPrompts ? (
                <div className="flex items-center justify-center py-4">
                  <Spinner size="sm" />
                </div>
              ) : (
                <Select
                  value={systemPromptId || ''}
                  onChange={(e) => setSystemPromptId(e.target.value || null)}
                >
                  <option value="">No system prompt (use default)</option>
                  {systemPrompts.map((prompt) => (
                    <option key={prompt.id} value={prompt.id}>
                      {prompt.name}
                    </option>
                  ))}
                </Select>
              )}
              {systemPromptId && systemPrompts.find((p) => p.id === systemPromptId) && (
                <div className="p-3 bg-muted rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground mb-2">
                    {systemPrompts.find((p) => p.id === systemPromptId)?.description || 'No description'}
                  </p>
                  <details className="group">
                    <summary className="text-xs text-primary cursor-pointer hover:text-foreground">
                      View prompt content
                    </summary>
                    <pre className="mt-2 p-2 bg-card rounded text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                      {systemPrompts.find((p) => p.id === systemPromptId)?.prompt_content}
                    </pre>
                  </details>
                </div>
              )}
            </div>

            {/* Claude Artifact URL */}
            <div className="space-y-2 pt-2 border-t border-border">
              <Label htmlFor="artifactUrl">Claude Artifact URL</Label>
              <Input
                id="artifactUrl"
                type="url"
                value={artifactUrl}
                onChange={(e) => setArtifactUrl(e.target.value)}
                placeholder="https://claude.ai/artifacts/..."
              />
              <p className="text-xs text-muted-foreground">
                This doesn&apos;t affect the template. It&apos;s used to save the original Claude artifact link so you can go back to adjust and copy code to the template HTML.
              </p>
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
              <Textarea
                id="htmlContent"
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                placeholder="<!DOCTYPE html>..."
                rows={15}
                className="font-mono text-sm"
              />
            </div>

            {/* Thumbnail Section */}
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <Label>Thumbnail</Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={thumbnailInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailUpload}
                    className="hidden"
                    id="thumbnail-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => thumbnailInputRef.current?.click()}
                    disabled={isUploadingThumbnail}
                    className="h-7 px-2 text-xs"
                  >
                    {isUploadingThumbnail ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3 h-3 mr-1" />
                        Upload Custom
                      </>
                    )}
                  </Button>
                  {useCustomThumbnail && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleUseAutoThumbnail}
                      className="h-7 px-2 text-xs"
                    >
                      Use Auto-Generated
                    </Button>
                  )}
                </div>
              </div>

              {isGeneratingThumbnail ? (
                <div className="flex items-center gap-2 px-4 py-6 bg-muted rounded-xl text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Generating thumbnail...</span>
                </div>
              ) : thumbnailUrl ? (
                <div className="relative">
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-muted">
                    <Image
                      src={thumbnailUrl}
                      alt="Thumbnail preview"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-xs text-white">
                    {useCustomThumbnail ? 'Custom' : 'Auto-generated'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setThumbnailUrl('')
                      setUseCustomThumbnail(false)
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-500/80 backdrop-blur rounded-full hover:bg-red-500 transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-4 py-8 bg-muted rounded-xl text-muted-foreground border-2 border-dashed border-border">
                  <Upload className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">Upload a thumbnail or add HTML to auto-generate</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Template Prompt */}
      <Card>
        <CardHeader>
          <CardTitle>Template Prompt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="templatePrompt">
              Custom Instructions for This Template
            </Label>
            <p className="text-xs text-muted-foreground">
              Add specific instructions that will be included in the generated prompt for Claude.
              This is useful for template-specific guidance like tone, style, or special formatting requirements.
            </p>
            <Textarea
              id="templatePrompt"
              value={templatePrompt}
              onChange={(e) => setTemplatePrompt(e.target.value)}
              placeholder="e.g., Use a professional and warm tone. Emphasize the property's unique features. Keep the text concise and impactful..."
              rows={8}
              className="font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Template Fields */}
      <Card>
        <CardHeader>
          <CardTitle>Template Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <TemplateFieldsEditor fields={templateFields} onChange={setTemplateFields} />
        </CardContent>
      </Card>
    </div>
  )
}
