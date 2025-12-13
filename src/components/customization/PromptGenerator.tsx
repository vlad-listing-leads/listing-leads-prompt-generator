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
    router.push('/designs')
  }

  return (
    <div className="fixed inset-0 bg-[#141414] z-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#1e1e1e] border-b border-white/5 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-lg text-white">{template.name}</h1>
            <p className="text-xs text-gray-500">Build your personalized prompt for Claude</p>
          </div>
        </div>
      </div>

      {/* Main Content - Swapped: Fields on left, Preview on right */}
      <div className="flex-1 flex overflow-hidden">
        {/* Field Input Sidebar (Left) - Desktop */}
        <div className="w-[420px] shrink-0 hidden md:block">
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

        {/* Preview (Right) */}
        <div className="flex-1 overflow-hidden border-l border-white/5">
          <StaticPreview htmlContent={template.html_content} />
        </div>

        {/* Mobile: Bottom sheet for fields */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1e1e1e] border-t border-white/5 max-h-[70vh] overflow-y-auto">
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
    </div>
  )
}
