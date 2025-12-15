'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Copy, Check, Loader2, FileDown, FileCode } from 'lucide-react'
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
  const [mounted, setMounted] = useState(false)
  const { theme } = useTheme()

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // PDF conversion state
  const [uploadedHtml, setUploadedHtml] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      toast.success('Prompt copied to clipboard')

      // Open Claude after 1.5 seconds
      setTimeout(() => {
        window.open('https://claude.ai/new', '_blank')
      }, 1500)

      // Reset copied state after delay
      setTimeout(() => {
        setCopied(false)
      }, 2500)
    } catch (err) {
      console.error('Failed to copy:', err)
      toast.error('Failed to copy prompt')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    processFile(file)
  }

  const processFile = (file: File) => {
    setPdfError('')
    setUploadedFileName(file.name)

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setUploadedHtml(content)
    }
    reader.onerror = () => {
      setPdfError('Failed to read file')
    }
    reader.readAsText(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    const file = e.dataTransfer.files?.[0]
    if (file && (file.name.endsWith('.html') || file.name.endsWith('.htm'))) {
      processFile(file)
    } else {
      setPdfError('Please drop an HTML file')
    }
  }

  const handleGeneratePdf = async () => {
    if (!uploadedHtml.trim()) {
      setPdfError('Please upload an HTML file first')
      return
    }

    setIsGeneratingPdf(true)
    setPdfError('')

    try {
      const response = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: uploadedHtml,
          filename: `${templateName.replace(/\s+/g, '-').toLowerCase()}-outlined`,
          outlined: true,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate PDF')
      }

      // Download the PDF
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${templateName.replace(/\s+/g, '-').toLowerCase()}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF generation error:', err)
      setPdfError('Failed to generate PDF. Please try again.')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-card border-r border-border relative">
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
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
                          ? 'bg-primary'
                          : 'bg-muted'
                      }`}
                    >
                      {index < loaderStep ? (
                        <Check className="w-4 h-4 text-white" />
                      ) : index === loaderStep ? (
                        <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                      )}
                    </div>
                    <span
                      className={`text-sm transition-colors duration-300 ${
                        index <= loaderStep ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="pt-4">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${((loaderStep + 1) / loaderSteps.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : isPromptGenerated ? (
          // Generated Prompt View - 10% padding left/right
          <div className="py-8 px-[10%] space-y-6">
            {/* Step 1 */}
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-secondary text-muted-foreground text-xs font-medium">Step 1</span>
              <h4 className="text-base font-medium text-foreground">Your prompt is ready</h4>
            </div>

            {/* Prompt Preview */}
            <div className="space-y-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Generated Prompt</span>
                <span className="text-xs text-muted-foreground">{generatedPrompt.length.toLocaleString()} chars</span>
              </div>
              <div className="bg-muted border border-border rounded-xl p-4 overflow-hidden">
                <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed line-clamp-5">
                  {generatedPrompt}
                </pre>
              </div>

              {/* Copy Button with Claude logo */}
              <Button
                onClick={handleCopyPrompt}
                className="w-full h-14 text-base"
                variant="outline"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Copied! Opening Claude...</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                    <Image src={mounted && theme === 'dark' ? '/claude.svg' : '/dark-claude.svg'} alt="Claude" width={70} height={18} className="opacity-70" />
                    <span>Prompt</span>
                  </>
                )}
              </Button>
            </div>

            {/* Divider */}
            <div className="py-4">
              <div className="border-t border-border" />
            </div>

            {/* Step 2 */}
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-secondary text-muted-foreground text-xs font-medium">Step 2</span>
              <h4 className="text-base font-medium text-foreground">Convert Claude HTML to Print-Ready PDF</h4>
            </div>

            {/* PDF Upload Area */}
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full h-24 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                  isDragActive
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50 hover:bg-accent'
                }`}
              >
                {uploadedFileName ? (
                  <>
                    <FileCode className="w-6 h-6 text-primary" />
                    <span className="text-sm text-foreground font-medium">{uploadedFileName}</span>
                    <span className="text-xs text-muted-foreground">Click or drag to change file</span>
                  </>
                ) : (
                  <>
                    <FileCode className={`w-6 h-6 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-sm ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`}>
                      {isDragActive ? 'Drop HTML file here' : 'Drag & drop or click to upload HTML'}
                    </span>
                  </>
                )}
              </button>

              {/* Error message */}
              {pdfError && (
                <p className="text-xs text-destructive">{pdfError}</p>
              )}

              {/* Generate Button */}
              <Button
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf || !uploadedHtml.trim()}
                className="w-full h-12"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4 mr-2" />
                    Download Print-Ready PDF
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
