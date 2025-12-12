'use client'

import { useState, useEffect } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Settings, Sparkles, Check, MessageSquare } from 'lucide-react'

type AIProvider = 'anthropic' | 'openai'

interface SettingsData {
  provider: AIProvider
  systemPrompt: string
}

function DarkCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#1e1e1e] rounded-2xl border border-white/5 ${className}`}>
      {children}
    </div>
  )
}

export default function AdminSettingsPage() {
  const [provider, setProvider] = useState<AIProvider>('anthropic')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings')
        if (response.ok) {
          const result = await response.json()
          setProvider(result.data?.value?.provider || 'anthropic')
          setSystemPrompt(result.data?.value?.systemPrompt || '')
        }
      } catch (err) {
        console.error('Error fetching settings:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSaveSuccess(false)

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'ai_provider',
          value: { provider, systemPrompt }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save settings')
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
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
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#f5d5d5]/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-[#f5d5d5]" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
        </div>
      </div>

      <DarkCard className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-[#f5d5d5]" />
          <h2 className="text-lg font-medium text-white">AI Settings</h2>
        </div>

        {/* AI Provider Section */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-300 mb-3">AI Provider</h3>
          <p className="text-sm text-gray-400 mb-4">
            Choose which AI provider to use for template customization.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Anthropic Option */}
            <button
              onClick={() => setProvider('anthropic')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                provider === 'anthropic'
                  ? 'border-[#f5d5d5] bg-[#f5d5d5]/10'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">Anthropic Claude</span>
                {provider === 'anthropic' && (
                  <div className="w-5 h-5 rounded-full bg-[#f5d5d5] flex items-center justify-center">
                    <Check className="w-3 h-3 text-[#141414]" />
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-400">
                Claude Sonnet 4 - Advanced reasoning and natural language understanding
              </p>
            </button>

            {/* OpenAI Option */}
            <button
              onClick={() => setProvider('openai')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                provider === 'openai'
                  ? 'border-[#f5d5d5] bg-[#f5d5d5]/10'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">OpenAI</span>
                {provider === 'openai' && (
                  <div className="w-5 h-5 rounded-full bg-[#f5d5d5] flex items-center justify-center">
                    <Check className="w-3 h-3 text-[#141414]" />
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-400">
                GPT-4o - Fast and capable for template generation
              </p>
            </button>
          </div>
        </div>

        {/* System Prompt Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-300">System Prompt</h3>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            This prompt will be included with every AI request for template personalization. Use it to define brand voice, style guidelines, or specific instructions.
          </p>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Example: Always maintain a professional tone. Use warm, welcoming language. Ensure contact information is prominently displayed..."
            className="w-full min-h-[600px] px-4 py-3 bg-[#2a2a2a] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#f5d5d5]/50 focus:ring-1 focus:ring-[#f5d5d5]/50 transition-colors resize-y"
          />
          <p className="text-xs text-gray-500 mt-2">
            {systemPrompt.length} characters
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {saveSuccess && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-400">Settings saved successfully!</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>
      </DarkCard>

      <DarkCard className="p-6 mt-6">
        <h3 className="text-white font-medium mb-2">Environment Variables Required</h3>
        <p className="text-sm text-gray-400 mb-4">
          Make sure you have the following environment variables set:
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 bg-[#2a2a2a] rounded text-xs text-gray-300">ANTHROPIC_API_KEY</code>
            <span className="text-sm text-gray-500">- Required for Claude</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 bg-[#2a2a2a] rounded text-xs text-gray-300">OPENAI_API_KEY</code>
            <span className="text-sm text-gray-500">- Required for OpenAI</span>
          </div>
        </div>
      </DarkCard>
    </div>
  )
}
