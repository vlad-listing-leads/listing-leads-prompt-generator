'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { FieldRenderer } from './FieldRenderer'
import { Copy, Check, Save, X, ExternalLink } from 'lucide-react'
import { TemplateField } from '@/types/database'
import { generateClaudePrompt } from '@/lib/prompt-generator'
import { AiLoader } from '@/components/ui/ai-loader'

interface ProfileField {
  id: string
  field_key: string
  label: string
  field_type: string
  category?: string
}

interface FieldInputSidebarProps {
  templateId: string
  templateName: string
  templateSize: string
  htmlContent: string
  templateFields: TemplateField[]
  profileFields: ProfileField[]
  profileValues: Record<string, string>
}

export function FieldInputSidebar({
  templateId,
  templateName,
  templateSize,
  htmlContent,
  templateFields,
  profileFields,
  profileValues,
}: FieldInputSidebarProps) {
  // Initialize with default values from template fields
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    templateFields.forEach((field) => {
      initial[field.field_key] = field.default_value || ''
    })
    return initial
  })
  const [isLoading, setIsLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [showLoader, setShowLoader] = useState(false)
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [copied, setCopied] = useState(false)
  const [includedSections, setIncludedSections] = useState<string[]>([])

  // Refs for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const valuesRef = useRef(values)
  valuesRef.current = values

  // Load saved values on mount
  useEffect(() => {
    const loadSavedValues = async () => {
      try {
        const response = await fetch(`/api/templates/${templateId}/values`)
        if (response.ok) {
          const result = await response.json()
          if (result.data?.values && Object.keys(result.data.values).length > 0) {
            setValues((prev) => ({
              ...prev,
              ...result.data.values,
            }))
          }
        }
      } catch (err) {
        console.error('Error loading saved values:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadSavedValues()
  }, [templateId])

  // Auto-save values when they change (debounced)
  const saveValues = useCallback(async (valuesToSave: Record<string, string>) => {
    setSaveStatus('saving')
    try {
      const response = await fetch(`/api/templates/${templateId}/values`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: valuesToSave }),
      })
      if (response.ok) {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      }
    } catch (err) {
      console.error('Error saving values:', err)
      setSaveStatus('idle')
    }
  }, [templateId])

  const handleFieldChange = useCallback((fieldKey: string, value: string) => {
    setValues((prev) => {
      const newValues = { ...prev, [fieldKey]: value }

      // Debounce save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveValues(newValues)
      }, 1000) // Save after 1 second of inactivity

      return newValues
    })
  }, [saveValues])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        // Save any pending changes
        saveValues(valuesRef.current)
      }
    }
  }, [saveValues])

  const handleGeneratePrompt = () => {
    // Show loader first
    setShowLoader(true)

    // Track included sections (only main categories)
    const sections: string[] = []

    // Check profile fields by category
    const profileCategories: Record<string, string> = {
      contact: 'Contact Details',
      business: 'Business Details',
      branding: 'Branding',
      social: 'Social & Web Links',
    }

    profileFields.forEach((field) => {
      const value = profileValues[field.field_key]
      if (value && value.trim()) {
        const catLabel = profileCategories[field.category || 'general'] || 'Other Information'
        if (!sections.includes(catLabel)) {
          sections.push(catLabel)
        }
      }
    })

    // Check if any template fields are filled
    const hasTemplateFields = templateFields.some((field) => {
      const value = values[field.field_key]
      return value && value.trim()
    })
    if (hasTemplateFields) {
      sections.push('Template Fields')
    }

    setIncludedSections(sections)

    // Generate prompt
    const prompt = generateClaudePrompt({
      htmlContent,
      templateName,
      templateSize: templateSize || '8.5x11 inches',
      templateFields,
      templateFieldValues: values,
      profileFields,
      profileValues,
    })
    setGeneratedPrompt(prompt)

    // Show modal after 1.5 seconds
    setTimeout(() => {
      setShowLoader(false)
      setShowModal(true)
      setCopied(false)
    }, 1500)
  }

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt)
      setCopied(true)
      // Open Claude.com in new tab
      window.open('https://claude.ai/new', '_blank')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Sort fields by display_order
  const sortedFields = [...templateFields].sort((a, b) => a.display_order - b.display_order)

  return (
    <>
      <div className="h-full flex flex-col bg-[#1e1e1e] border-l border-white/5">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-white">Template Fields</h2>
              <p className="text-xs text-gray-500 mt-0.5">Fill in the details for this template</p>
            </div>
            {saveStatus !== 'idle' && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                {saveStatus === 'saving' && (
                  <>
                    <Save className="w-3 h-3 animate-pulse" />
                    Saving...
                  </>
                )}
                {saveStatus === 'saved' && (
                  <>
                    <Check className="w-3 h-3 text-green-500" />
                    Saved
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Fields */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 dark-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#f5d5d5]"></div>
            </div>
          ) : sortedFields.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No fields configured for this template</p>
            </div>
          ) : (
            sortedFields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={values[field.field_key] || ''}
                onChange={(val) => handleFieldChange(field.field_key, val)}
              />
            ))
          )}
        </div>

        {/* Generate Button */}
        <div className="p-4 border-t border-white/5">
          <Button
            onClick={handleGeneratePrompt}
            className="w-full bg-[#D97757] text-white hover:bg-[#C96747] flex items-center justify-center gap-1.5"
          >
            Generate Prompt for
            <Image src="/claude.svg" alt="Claude" width={70} height={16} className="brightness-0 invert" />
          </Button>
        </div>
      </div>

      {/* Loader Overlay */}
      {showLoader && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
          <AiLoader text="Generating prompt" showSubtitle={false} />
        </div>
      )}

      {/* Prompt Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#1e1e1e] rounded-xl border border-white/10 w-full max-w-2xl shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Prompt created successfully</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Ready to paste into Claude</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split Content */}
            <div className="flex">
              {/* Left: Action (bigger) */}
              <div className="flex-1 p-6 flex flex-col justify-center border-r border-white/5">
                <div className="text-center mb-5">
                  <Image src="/claude.svg" alt="Claude" width={120} height={28} className="mx-auto mb-3 opacity-90" />
                  <p className="text-sm text-gray-400">Copy and paste into Claude.ai</p>
                </div>
                <Button
                  onClick={handleCopyPrompt}
                  className="w-full h-12 text-base bg-[#D97757] text-white hover:bg-[#C96747]"
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5 mr-2" />
                      Copy & Open Claude
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>

              {/* Right: Included Sections */}
              <div className="w-56 p-5">
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Included</h4>
                <div className="space-y-2">
                  {includedSections.map((section, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="text-sm text-white">{section}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
