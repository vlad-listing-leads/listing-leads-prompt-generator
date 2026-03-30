'use client'

import { useRouter } from 'next/navigation'
import { TemplateWithFields } from '@/types'
import { StaticPreview } from './StaticPreview'
import { FieldInputSidebar } from './FieldInputSidebar'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

interface ProfileField {
  id: string
  field_key: string
  label: string
  field_type: string
  category?: string
}

interface SystemPrompt {
  id: string
  name: string
  description: string | null
  prompt_content: string
}

interface PromptGeneratorProps {
  template: TemplateWithFields & { system_prompt?: SystemPrompt | null; template_prompt?: string | null }
  profileFields: ProfileField[]
  profileValues: Record<string, string>
}

export function PromptGenerator({ template, profileFields, profileValues }: PromptGeneratorProps) {
  const router = useRouter()

  const handleBack = () => {
    router.push('/templates')
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-lg text-foreground">{template.name}</h1>
            <p className="text-xs text-muted-foreground">Build your personalized prompt for Claude</p>
          </div>
        </div>
      </div>

      {/* Main Content - 50/50 split on desktop, full width on mobile */}
      <div className="flex-1 flex overflow-hidden">
        {/* Field Input (Left) - Desktop only - 50% */}
        <div className="w-1/2 shrink-0 hidden md:block">
          <FieldInputSidebar
            templateId={template.id}
            templateName={template.name}
            templateSize={template.size || '8.5x11 inches'}
            htmlContent={template.html_content}
            templateFields={template.template_fields}
            profileFields={profileFields}
            profileValues={profileValues}
            systemPrompt={template.system_prompt?.prompt_content}
            templatePrompt={template.template_prompt}
          />
        </div>

        {/* Preview - Full width on mobile, 50% on desktop */}
        <div className="w-full md:w-1/2 overflow-hidden md:border-l border-border pb-[70vh] md:pb-0">
          <StaticPreview htmlContent={template.html_content} />
        </div>
      </div>

      {/* Mobile: Bottom sheet for fields */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border h-[70vh] overflow-y-auto">
        <FieldInputSidebar
          templateId={template.id}
          templateName={template.name}
          templateSize={template.size || '8.5x11 inches'}
          htmlContent={template.html_content}
          templateFields={template.template_fields}
          profileFields={profileFields}
          profileValues={profileValues}
          systemPrompt={template.system_prompt?.prompt_content}
          templatePrompt={template.template_prompt}
        />
      </div>
    </div>
  )
}
