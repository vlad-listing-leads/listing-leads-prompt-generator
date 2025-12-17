'use client'

import { useState, useEffect } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Settings, Sparkles, Check, LayoutGrid } from 'lucide-react'

type AIProvider = 'anthropic' | 'openai'
type CampaignSortOrder = 'name_asc' | 'name_desc' | 'created_at_desc' | 'created_at_asc'

export default function AdminSettingsPage() {
  const [provider, setProvider] = useState<AIProvider>('anthropic')
  const [campaignSort, setCampaignSort] = useState<CampaignSortOrder>('created_at_desc')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings?all=true')
        if (response.ok) {
          const result = await response.json()
          if (result.data) {
            const aiSetting = result.data.find((s: { key: string }) => s.key === 'ai_provider')
            const sortSetting = result.data.find((s: { key: string }) => s.key === 'campaign_sort_order')
            setProvider(aiSetting?.value?.provider || 'anthropic')
            setCampaignSort(sortSetting?.value?.sort_order || 'created_at_desc')
          }
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
      // Save both settings
      const [aiResponse, sortResponse] = await Promise.all([
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: 'ai_provider',
            value: { provider }
          })
        }),
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: 'campaign_sort_order',
            value: { sort_order: campaignSort }
          })
        })
      ])

      if (!aiResponse.ok || !sortResponse.ok) {
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
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-medium text-foreground">AI Settings</h2>
        </div>

        {/* AI Provider Section */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-foreground mb-3">AI Provider</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Choose which AI provider to use for template customization.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Anthropic Option */}
            <button
              onClick={() => setProvider('anthropic')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                provider === 'anthropic'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-foreground font-medium">Anthropic Claude</span>
                {provider === 'anthropic' && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Claude Sonnet 4 - Advanced reasoning and natural language understanding
              </p>
            </button>

            {/* OpenAI Option */}
            <button
              onClick={() => setProvider('openai')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                provider === 'openai'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-foreground font-medium">OpenAI</span>
                {provider === 'openai' && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                GPT-4o - Fast and capable for template generation
              </p>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {saveSuccess && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-600 dark:text-green-400">Settings saved successfully!</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button
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
      </Card>

      {/* Campaign Sort Order */}
      <Card className="p-6 mt-6">
        <div className="flex items-center gap-2 mb-6">
          <LayoutGrid className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-medium text-foreground">Campaign Display</h2>
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-medium text-foreground mb-3">Default Sort Order</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Choose how campaigns are sorted on the designs page.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { value: 'name_asc', label: 'Name (A-Z)', desc: 'Alphabetically ascending' },
              { value: 'name_desc', label: 'Name (Z-A)', desc: 'Alphabetically descending' },
              { value: 'created_at_desc', label: 'Newest First', desc: 'Most recently created' },
              { value: 'created_at_asc', label: 'Oldest First', desc: 'Oldest created first' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setCampaignSort(option.value as CampaignSortOrder)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  campaignSort === option.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-foreground font-medium text-sm">{option.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{option.desc}</p>
                  </div>
                  {campaignSort === option.value && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0 ml-2">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-6 mt-6">
        <h3 className="text-foreground font-medium mb-2">Environment Variables Required</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Make sure you have the following environment variables set:
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 bg-muted rounded text-xs text-foreground">ANTHROPIC_API_KEY</code>
            <span className="text-sm text-muted-foreground">- Required for Claude</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 bg-muted rounded text-xs text-foreground">OPENAI_API_KEY</code>
            <span className="text-sm text-muted-foreground">- Required for OpenAI</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
