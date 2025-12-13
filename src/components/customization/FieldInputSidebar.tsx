'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { FieldRenderer } from './FieldRenderer'
import { Copy, Check, Save, ChevronLeft, ChevronRight, ExternalLink, Loader2 } from 'lucide-react'
import { TemplateField } from '@/types/database'
import { generateClaudePrompt } from '@/lib/prompt-generator'

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
  systemPrompt?: string
  templatePrompt?: string | null
}

export function FieldInputSidebar({
  templateId,
  templateName,
  templateSize,
  htmlContent,
  templateFields,
  profileFields,
  profileValues,
  systemPrompt,
  templatePrompt,
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

  // Step wizard state
  const [currentStep, setCurrentStep] = useState(0)
  const [showLoader, setShowLoader] = useState(false)
  const [loaderStep, setLoaderStep] = useState(0)
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [copied, setCopied] = useState(false)
  const [isPromptGenerated, setIsPromptGenerated] = useState(false)

  const loaderSteps = [
    'Adding your brand information',
    'Adding your profile information',
    'Optimizing prompt',
  ]

  // Refs for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const valuesRef = useRef(values)
  valuesRef.current = values

  // Sort fields by display_order
  const sortedFields = [...templateFields].sort((a, b) => a.display_order - b.display_order)
  const totalSteps = sortedFields.length

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
      }, 1000)

      return newValues
    })
  }, [saveValues])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveValues(valuesRef.current)
      }
    }
  }, [saveValues])

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleGeneratePrompt = () => {
    setShowLoader(true)
    setLoaderStep(0)

    // Generate prompt
    const prompt = generateClaudePrompt({
      htmlContent,
      templateName,
      templateSize: templateSize || '8.5x11 inches',
      templateFields,
      templateFieldValues: values,
      profileFields,
      profileValues,
      systemPrompt,
      templatePrompt: templatePrompt || undefined,
    })
    setGeneratedPrompt(prompt)

    // Step through loader messages
    setTimeout(() => setLoaderStep(1), 800)
    setTimeout(() => setLoaderStep(2), 1600)

    // Show prompt after all steps
    setTimeout(() => {
      setShowLoader(false)
      setIsPromptGenerated(true)
      setCopied(false)
    }, 2400)
  }

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt)
      setCopied(true)
      window.open('https://claude.ai/new', '_blank')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleBackToSteps = () => {
    setIsPromptGenerated(false)
    setCurrentStep(0)
  }

  const currentField = sortedFields[currentStep]

  return (
    <>
      <div className="h-full flex flex-col bg-[#1e1e1e] border-r border-white/5">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Prompt Building</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {isPromptGenerated
                  ? 'Your prompt is ready'
                  : `Answer the questions to build your prompt`
                }
              </p>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto dark-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f5d5d5]"></div>
            </div>
          ) : showLoader ? (
            // Loader View - Stacked checkmarks with progress bar
            <div className="flex flex-col items-center justify-center h-full p-6">
              <div className="w-full max-w-xs space-y-4">
                {/* Stacked checkmark items */}
                <div className="space-y-3">
                  {loaderSteps.map((step, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 transition-all duration-300 ${
                        index <= loaderStep ? 'opacity-100' : 'opacity-30'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                          index < loaderStep
                            ? 'bg-green-500'
                            : index === loaderStep
                            ? 'bg-[#D97757]'
                            : 'bg-white/10'
                        }`}
                      >
                        {index < loaderStep ? (
                          <Check className="w-4 h-4 text-white" />
                        ) : index === loaderStep ? (
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-white/30" />
                        )}
                      </div>
                      <span
                        className={`text-sm transition-colors duration-300 ${
                          index <= loaderStep ? 'text-white' : 'text-gray-500'
                        }`}
                      >
                        {step}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div className="pt-4">
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#D97757] transition-all duration-500 ease-out rounded-full"
                      style={{ width: `${((loaderStep + 1) / loaderSteps.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : isPromptGenerated ? (
            // Generated Prompt View
            <div className="p-6 space-y-4">
              {/* Success Header */}
              <div className="text-center pb-4 border-b border-white/5">
                <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-white">Prompt Ready!</h3>
                <p className="text-sm text-gray-400 mt-1">Copy and paste into Claude</p>
              </div>

              {/* Prompt Preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Generated Prompt</span>
                  <span className="text-xs text-gray-500">{generatedPrompt.length.toLocaleString()} chars</span>
                </div>
                <div className="bg-[#141414] border border-white/10 rounded-xl p-4 max-h-64 overflow-y-auto dark-scrollbar">
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {generatedPrompt.slice(0, 1500)}
                    {generatedPrompt.length > 1500 && (
                      <span className="text-gray-500">... ({generatedPrompt.length - 1500} more characters)</span>
                    )}
                  </pre>
                </div>
              </div>

              {/* Copy Button */}
              <div className="pt-4 space-y-3">
                <Image src="/claude.svg" alt="Claude" width={90} height={22} className="mx-auto opacity-60" />
                <Button
                  onClick={handleCopyPrompt}
                  className="w-full h-12 text-base bg-[#D97757] text-white hover:bg-[#C96747] rounded-xl"
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      Copied! Opening Claude...
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5 mr-2" />
                      Copy & Open Claude
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
                <button
                  onClick={handleBackToSteps}
                  className="w-full text-sm text-gray-400 hover:text-white transition-colors py-2"
                >
                  ← Back to edit fields
                </button>
              </div>
            </div>
          ) : sortedFields.length === 0 ? (
            // No Fields View
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <p className="text-gray-500 mb-4">No fields configured for this template</p>
              <Button
                onClick={handleGeneratePrompt}
                className="bg-[#D97757] text-white hover:bg-[#C96747]"
              >
                Generate Prompt Anyway
              </Button>
            </div>
          ) : (
            // Step Wizard View
            <div className="p-6">
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[#D97757]">
                    Step {currentStep + 1} of {totalSteps}
                  </span>
                  <span className="text-xs text-gray-500">
                    {Math.round(((currentStep + 1) / totalSteps) * 100)}% complete
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#D97757] transition-all duration-300 rounded-full"
                    style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                  />
                </div>
              </div>

              {/* Step Indicators */}
              <div className="flex justify-center gap-1.5 mb-6">
                {sortedFields.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentStep(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentStep
                        ? 'bg-[#D97757] w-6'
                        : index < currentStep
                        ? 'bg-[#D97757]/50'
                        : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>

              {/* Current Field */}
              {currentField && (
                <div className="space-y-4">
                  <div className="bg-[#2a2a2a] rounded-xl p-5 border border-white/5">
                    <FieldRenderer
                      field={currentField}
                      value={values[currentField.field_key] || ''}
                      onChange={(val) => handleFieldChange(currentField.field_key, val)}
                    />
                  </div>

                  {/* Field hint */}
                  {currentField.placeholder && (
                    <p className="text-xs text-gray-500 italic px-1">
                      Tip: {currentField.placeholder}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {!isLoading && !showLoader && !isPromptGenerated && sortedFields.length > 0 && (
          <div className="p-4 border-t border-white/5 space-y-3">
            {/* Navigation Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="flex-1"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              {currentStep === totalSteps - 1 ? (
                <Button
                  onClick={handleGeneratePrompt}
                  className="flex-1 bg-[#D97757] text-white hover:bg-[#C96747]"
                >
                  Generate Prompt
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  className="flex-1 bg-[#D97757] text-white hover:bg-[#C96747]"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>

            {/* Skip to Generate */}
            <button
              onClick={handleGeneratePrompt}
              className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors py-1"
            >
              Skip and generate prompt now
            </button>
          </div>
        )}
      </div>
    </>
  )
}
