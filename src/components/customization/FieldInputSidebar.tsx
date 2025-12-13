'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Copy, Check, Loader2 } from 'lucide-react'
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
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    templateFields.forEach((field) => {
      initial[field.field_key] = field.default_value || ''
    })
    return initial
  })
  const [showLoader, setShowLoader] = useState(true)
  const [loaderStep, setLoaderStep] = useState(0)
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [copied, setCopied] = useState(false)
  const [isPromptGenerated, setIsPromptGenerated] = useState(false)

  const loaderSteps = [
    'Adding your brand information',
    'Adding your profile information',
    'Optimizing prompt',
  ]

  const valuesRef = useRef(values)
  valuesRef.current = values

  // Load saved values and generate prompt on mount
  useEffect(() => {
    const loadAndGenerate = async () => {
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
      }

      // Start generating immediately
      triggerGeneration()
    }

    loadAndGenerate()
  }, [templateId])

  const triggerGeneration = useCallback(() => {
    setShowLoader(true)
    setLoaderStep(0)

    // Generate prompt using ref for latest values
    const prompt = generateClaudePrompt({
      htmlContent,
      templateName,
      templateSize: templateSize || '8.5x11 inches',
      templateFields,
      templateFieldValues: valuesRef.current,
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
  }, [htmlContent, templateName, templateSize, templateFields, profileFields, profileValues, systemPrompt, templatePrompt])

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

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] border-r border-white/5">
      {/* Content */}
      <div className="flex-1 overflow-y-auto dark-scrollbar">
        {showLoader ? (
          // Loader View - Stacked checkmarks with progress bar
          <div className="flex flex-col items-center justify-center h-full p-6">
            <div className="w-full max-w-xs space-y-6">
              {/* Claude loading animation */}
              <div className="flex justify-center">
                <Image
                  src="/claude-loading-animation.svg"
                  alt="Claude"
                  width={60}
                  height={60}
                  className="opacity-80"
                />
              </div>

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
          // Generated Prompt View - 10% padding left/right
          <div className="py-8 px-[10%] space-y-6">
            {/* Success Header */}
            <div className="text-center pb-4 border-b border-white/5">
              <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-white">Your prompt is ready</h3>
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

            {/* Copy Button with Claude logo */}
            <div className="pt-2">
              <Button
                onClick={handleCopyPrompt}
                className="w-full h-14 text-base bg-[#2a2a2a] text-white hover:bg-[#3a3a3a] border border-white/10 rounded-xl flex items-center justify-center gap-3"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Copied! Opening Claude...</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy & Open</span>
                    <Image src="/claude.svg" alt="Claude" width={70} height={18} className="opacity-90" />
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
