'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { TemplateWithFields } from '@/types'
import { LivePreview, LivePreviewHandle } from './LivePreview'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { Save, Download, X, FileText, Sparkles, MessageSquare, History, User, Bot, ImagePlus, ChevronDown } from 'lucide-react'

interface PromptHistoryItem {
  id: string
  prompt: string
  timestamp: Date | string
  type: 'user' | 'system'
  image?: string // Base64 image data
}

interface ChangeLogItem {
  id: string
  description: string
  timestamp: Date | string
}

interface ProfileFieldInfo {
  field_key: string
  label: string
  field_type: string
}

interface CustomizationFormProps {
  template: TemplateWithFields
  customizationId?: string
  initialValues?: Record<string, string>
  profileFields?: ProfileFieldInfo[] // Profile fields for AI to use
  initialName?: string
  initialRenderedHtml?: string | null
  initialPromptHistory?: PromptHistoryItem[]
  initialChangeLog?: ChangeLogItem[]
  autoGenerate?: boolean // Auto-generate on first load with profile data
}

export function CustomizationForm({
  template,
  customizationId,
  initialValues = {},
  profileFields = [],
  initialName = '',
  initialRenderedHtml,
  initialPromptHistory = [],
  initialChangeLog = [],
  autoGenerate = false,
}: CustomizationFormProps) {
  const router = useRouter()
  const [name] = useState(initialName || `My ${template.name}`)
  const [values] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    template.template_fields?.forEach((field) => {
      defaults[field.field_key] = initialValues[field.field_key] ?? field.default_value ?? ''
    })
    return defaults
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // AI state - use saved rendered HTML if available, otherwise use template
  const [isGenerating, setIsGenerating] = useState(false)
  const [renderedHtml, setRenderedHtml] = useState(initialRenderedHtml || template.html_content)
  const [userPrompt, setUserPrompt] = useState('')
  const [promptHistory, setPromptHistory] = useState<PromptHistoryItem[]>(initialPromptHistory)
  const [changeLog, setChangeLog] = useState<ChangeLogItem[]>(initialChangeLog)
  const [activeTab, setActiveTab] = useState<'prompts' | 'changes'>('prompts')

  const previewRef = useRef<LivePreviewHandle>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachedImage, setAttachedImage] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false)

  // Check if any values have content (from profile or template values)
  const hasValues = Object.values(values).some(v => v && v.trim())
  const hasProfileValues = Object.values(initialValues).some(v => v && v.trim())

  // Scroll to bottom of chat when new messages added
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [promptHistory])

  // Generate AI-customized HTML - uses current rendered HTML as base (not original template)
  const generateAiHtml = useCallback(async (promptOverride?: string, imageData?: string | null) => {
    const promptToUse = promptOverride || ''
    const imageToUse = imageData !== undefined ? imageData : attachedImage

    if (!hasValues && !hasProfileValues && !promptToUse && !imageToUse) {
      setRenderedHtml(template.html_content)
      return
    }

    setIsGenerating(true)

    // Add user prompt to history if provided
    if (promptToUse || imageToUse) {
      const newPrompt: PromptHistoryItem = {
        id: `prompt-${Date.now()}`,
        prompt: promptToUse || '(Image attached)',
        timestamp: new Date(),
        type: 'user',
        image: imageToUse || undefined
      }
      setPromptHistory(prev => [...prev, newPrompt])
    }

    // Clear attached image after sending
    setAttachedImage(null)

    try {
      const fieldsToUse = profileFields.length > 0 ? profileFields : (template.template_fields || [])
      const valuesToUse = profileFields.length > 0 ? initialValues : values
      const hasFieldValues = Object.values(valuesToUse).some(v => v && String(v).trim())

      // Use fast tool-based editing for simple text prompts (no image, no field values)
      const useFastEdit = promptToUse && !imageToUse && !hasFieldValues

      if (useFastEdit) {
        // Try fast tool-based editing first
        const response = await fetch('/api/ai/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            htmlContent: renderedHtml,
            userPrompt: promptToUse,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to edit')
        }

        const data = await response.json()

        if (data.html) {
          setRenderedHtml(data.html)
        }
      } else {
        // Regular request for images or field values
        const response = await fetch('/api/ai/customize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            htmlContent: renderedHtml,
            fields: fieldsToUse || [],
            values: valuesToUse || {},
            userPrompt: promptToUse,
            image: imageToUse,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to customize')
        }

        const data = await response.json()
        setRenderedHtml(data.html)
      }

      // Add system response to history
      const systemResponse: PromptHistoryItem = {
        id: `response-${Date.now()}`,
        prompt: 'Template updated successfully',
        timestamp: new Date(),
        type: 'system'
      }
      setPromptHistory(prev => [...prev, systemResponse])

      // Add to change log
      const changeDescription = promptToUse
        ? `Applied: "${promptToUse.length > 50 ? promptToUse.slice(0, 50) + '...' : promptToUse}"`
        : 'Regenerated with field values'

      const newChange: ChangeLogItem = {
        id: `change-${Date.now()}`,
        description: changeDescription,
        timestamp: new Date()
      }
      setChangeLog(prev => [...prev, newChange])

    } catch (error) {
      console.error('AI customization error:', error)
      const errorResponse: PromptHistoryItem = {
        id: `error-${Date.now()}`,
        prompt: 'Failed to generate. Please try again.',
        timestamp: new Date(),
        type: 'system'
      }
      setPromptHistory(prev => [...prev, errorResponse])
      // Keep current state on error - don't revert
    } finally {
      setIsGenerating(false)
    }
  }, [template.html_content, template.template_fields, values, hasValues, hasProfileValues, renderedHtml, profileFields, initialValues, attachedImage])

  const handleRegenerate = () => {
    generateAiHtml(userPrompt, attachedImage)
    setUserPrompt('')
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be less than 10MB')
      return
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    setIsUploadingImage(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', '/_personalization')

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      setAttachedImage(result.url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setIsUploadingImage(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeAttachedImage = () => {
    setAttachedImage(null)
  }

  const handlePromptKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleRegenerate()
    }
  }

  // Fetch user role to check admin status
  useEffect(() => {
    const fetchUserRole = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        setIsAdmin(data?.role === 'admin')
      }
    }

    fetchUserRole()
  }, [])

  // Auto-generate on first load if profile data is available
  const [hasAutoGenerated, setHasAutoGenerated] = useState(false)
  useEffect(() => {
    // Check if we have profile values OR template values to auto-generate with
    const shouldAutoGenerate = autoGenerate && (hasValues || hasProfileValues) && !hasAutoGenerated && !initialRenderedHtml

    if (shouldAutoGenerate) {
      setHasAutoGenerated(true)
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        generateAiHtml('Apply my profile information to personalize this template')
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [autoGenerate, hasValues, hasProfileValues, hasAutoGenerated, initialRenderedHtml, generateAiHtml])

  useEffect(() => {
    if (hasUnsavedChanges && customizationId) {
      const timer = setTimeout(() => {
        handleSave(true)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [hasUnsavedChanges, customizationId, values, name])

  const handleSave = async (isAutoSave = false) => {
    setIsSaving(true)
    setSaveError(null)

    try {
      const url = customizationId
        ? `/api/customizations/${customizationId}`
        : '/api/customizations'

      // Serialize dates in prompt history and change log
      const serializedPromptHistory = promptHistory.map(item => ({
        ...item,
        timestamp: item.timestamp instanceof Date ? item.timestamp.toISOString() : item.timestamp,
      }))
      const serializedChangeLog = changeLog.map(item => ({
        ...item,
        timestamp: item.timestamp instanceof Date ? item.timestamp.toISOString() : item.timestamp,
      }))

      const response = await fetch(url, {
        method: customizationId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template.id,
          name,
          values,
          rendered_html: renderedHtml,
          prompt_history: serializedPromptHistory,
          change_log: serializedChangeLog,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save')
      }

      setHasUnsavedChanges(false)
      setSaveSuccess(true)

      if (!customizationId && result.data?.id) {
        router.replace(`/my-designs/${result.data.id}`)
      } else {
        // Refresh to get latest data
        router.refresh()
      }
    } catch (error) {
      if (!isAutoSave) {
        setSaveError(error instanceof Error ? error.message : 'Failed to save')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDownloadHtml = () => {
    const blob = new Blob([renderedHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true)

    try {
      // Send to server for PDF generation
      const response = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: renderedHtml,
          filename: name.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate PDF')
      }

      // Get the PDF blob
      const blob = await response.blob()

      // Create download link
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

    } catch (error) {
      console.error('PDF generation error:', error)
      setSaveError('Failed to generate PDF. Please try again.')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const handleClose = () => {
    router.push('/my-designs')
  }

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="fixed inset-0 bg-[#141414] z-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#1e1e1e] border-b border-white/5 px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="shrink-0"
          >
            <X className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm sm:text-lg text-white truncate">{template.name}</h1>
            {hasUnsavedChanges && (
              <p className="text-xs text-gray-500">Unsaved changes</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {saveSuccess && (
            <span className="text-xs sm:text-sm text-green-400 mr-1 sm:mr-2 hidden sm:inline">Saved!</span>
          )}
          <Button
            variant="outline"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="px-2 sm:px-3"
            size="sm"
          >
            {isSaving ? (
              <Spinner size="sm" />
            ) : (
              <>
                <Save className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Save</span>
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadHtml}
            className="hidden sm:flex px-2 sm:px-3"
            size="sm"
          >
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden md:inline">HTML</span>
          </Button>
          <Button
            variant="primary"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="px-2 sm:px-3"
            size="sm"
          >
            {isGeneratingPdf ? (
              <Spinner size="sm" />
            ) : (
              <>
                <FileText className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">PDF</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {saveError && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
          <p className="text-sm text-red-400">{saveError}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Preview */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full bg-[#1a1a1a]">
            <LivePreview
              ref={previewRef}
              htmlContent={renderedHtml}
              fullHeight
              isLoading={isGenerating}
            />
          </div>
        </div>

        {/* Mobile Chat Toggle Button */}
        <button
          onClick={() => setIsMobileChatOpen(true)}
          className="md:hidden fixed bottom-4 right-4 z-40 bg-[#f5d5d5] text-[#141414] rounded-full p-4 shadow-lg hover:bg-[#e5c5c5] transition-colors"
        >
          <MessageSquare className="w-6 h-6" />
        </button>

        {/* Mobile Chat Overlay */}
        {isMobileChatOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsMobileChatOpen(false)}
          />
        )}

        {/* Right Sidebar - AI Chat & Change Log (Desktop: sidebar, Mobile: slide-up panel) */}
        <div className={`
          md:relative md:w-80 md:translate-y-0 md:rounded-none md:max-h-none
          fixed inset-x-0 bottom-0 z-50 bg-[#1e1e1e] border-l-0 md:border-l border-white/5 flex flex-col
          transition-transform duration-300 ease-out
          rounded-t-2xl md:rounded-t-none
          max-h-[85vh]
          ${isMobileChatOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
        `}>
            {/* Mobile Handle Bar */}
            <div className="md:hidden flex justify-center py-2 border-b border-white/5">
              <button
                onClick={() => setIsMobileChatOpen(false)}
                className="w-12 h-1.5 bg-gray-600 rounded-full"
              />
            </div>

            {/* Mobile Header with Close */}
            <div className="md:hidden flex items-center justify-between px-4 py-2 border-b border-white/5">
              <span className="text-sm font-medium text-white">AI Assistant</span>
              <button
                onClick={() => setIsMobileChatOpen(false)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Header */}
            <div className="flex border-b border-white/5 shrink-0">
              <button
                className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === 'prompts'
                    ? 'text-[#f5d5d5] border-b-2 border-[#f5d5d5]'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
                onClick={() => setActiveTab('prompts')}
              >
                <MessageSquare className="w-4 h-4" />
                AI Chat
              </button>
              <button
                className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === 'changes'
                    ? 'text-[#f5d5d5] border-b-2 border-[#f5d5d5]'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
                onClick={() => setActiveTab('changes')}
              >
                <History className="w-4 h-4" />
                Changes
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {activeTab === 'prompts' ? (
                <div className="p-4 space-y-3">
                  {promptHistory.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No prompts yet</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Enter instructions below to customize the template
                      </p>
                    </div>
                  ) : (
                    promptHistory.map((item) => (
                      <div
                        key={item.id}
                        className={`flex gap-2 ${item.type === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {item.type === 'system' && (
                          <div className="w-6 h-6 rounded-full bg-[#f5d5d5]/20 flex items-center justify-center shrink-0">
                            <Bot className="w-3 h-3 text-[#f5d5d5]" />
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 ${
                            item.type === 'user'
                              ? 'bg-[#f5d5d5]/20 text-[#f5d5d5]'
                              : 'bg-[#2a2a2a] text-gray-300'
                          }`}
                        >
                          {item.image && (
                            <img
                              src={item.image}
                              alt="Attached"
                              className="max-w-full rounded mb-2 max-h-32 object-contain"
                            />
                          )}
                          <p className="text-sm">{item.prompt}</p>
                          <p className="text-[10px] opacity-50 mt-1">
                            {formatTime(item.timestamp)}
                          </p>
                        </div>
                        {item.type === 'user' && (
                          <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center shrink-0">
                            <User className="w-3 h-3 text-gray-300" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {changeLog.length === 0 ? (
                    <div className="text-center py-8">
                      <History className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No changes yet</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Changes will appear here as you customize
                      </p>
                    </div>
                  ) : (
                    changeLog.map((item) => (
                      <div
                        key={item.id}
                        className="bg-[#2a2a2a] rounded-lg px-3 py-2 border border-white/5"
                      >
                        <p className="text-sm text-gray-300">{item.description}</p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {formatTime(item.timestamp)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* AI Prompt Input */}
            <div className="shrink-0 p-4 border-t border-white/5 pb-safe">
              <div className="space-y-2">
                {/* Attached Image Preview */}
                {attachedImage && (
                  <div className="relative inline-block">
                    <img
                      src={attachedImage}
                      alt="Attached"
                      className="max-h-20 rounded border border-white/10"
                    />
                    <button
                      onClick={removeAttachedImage}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                )}
                <div className="relative">
                  <Textarea
                    placeholder="Enter AI instructions..."
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    onKeyDown={handlePromptKeyDown}
                    className="resize-none text-sm min-h-[60px] md:min-h-[80px] bg-[#2a2a2a] border-white/10 pr-10"
                    rows={2}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="absolute right-2 bottom-2 p-1.5 text-gray-400 hover:text-[#f5d5d5] transition-colors rounded hover:bg-white/5 disabled:opacity-50"
                    title="Attach image"
                  >
                    {isUploadingImage ? (
                      <Spinner size="sm" />
                    ) : (
                      <ImagePlus className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <Button
                  onClick={handleRegenerate}
                  disabled={isGenerating || (!userPrompt.trim() && !hasValues && !attachedImage)}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
      </div>
    </div>
  )
}
