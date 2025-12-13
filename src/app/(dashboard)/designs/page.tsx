'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Template, Campaign } from '@/types'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { LayoutTemplate, Search, Eye, X } from 'lucide-react'

interface TemplateWithCampaign extends Template {
  campaign_id?: string | null
  campaign?: { id: string; name: string; color: string } | null
}

export default function DesignsPage() {
  const [templates, setTemplates] = useState<TemplateWithCampaign[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<TemplateWithCampaign | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [templatesRes, campaignsRes] = await Promise.all([
          fetch('/api/templates'),
          fetch('/api/campaigns'),
        ])

        const [templatesResult, campaignsResult] = await Promise.all([
          templatesRes.json(),
          campaignsRes.json(),
        ])

        if (!templatesRes.ok) {
          throw new Error(templatesResult.error || 'Failed to fetch designs')
        }

        setTemplates(templatesResult.data)
        setCampaigns(campaignsResult.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCampaign = !selectedCampaign || template.campaign_id === selectedCampaign

    return matchesSearch && matchesCampaign
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-semibold text-white">Designs</h1>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/10 text-gray-400">
            alpha
          </span>
        </div>
        <p className="mt-1 text-sm sm:text-base text-gray-400">
          Select a design to personalize and generate your prompt
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 mb-6">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Search and Filters */}
      <div className="mb-6 space-y-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Campaign Filter Pills */}
        {campaigns.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-hide">
            <button
              onClick={() => setSelectedCampaign(null)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap flex-shrink-0 ${
                selectedCampaign === null
                  ? 'bg-white text-gray-900'
                  : 'bg-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#333]'
              }`}
            >
              All Designs
            </button>
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                onClick={() => setSelectedCampaign(campaign.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                  selectedCampaign === campaign.id
                    ? 'bg-white text-gray-900'
                    : 'bg-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#333]'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: campaign.color }} />
                {campaign.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12 sm:py-16 bg-[#1e1e1e] rounded-2xl border border-white/5">
          {templates.length === 0 ? (
            <>
              <LayoutTemplate className="w-10 sm:w-12 h-10 sm:h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 px-4">No designs available yet</p>
            </>
          ) : (
            <>
              <Search className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400">No designs match your search</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-[#1e1e1e] rounded-2xl border border-white/5 overflow-hidden hover:border-white/10 transition-all group"
            >
              <div className="relative aspect-video bg-[#2a2a2a]">
                {template.thumbnail_url ? (
                  <Image
                    src={template.thumbnail_url}
                    alt={template.name}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    <span className="text-sm">No preview</span>
                  </div>
                )}

                {/* Campaign badge */}
                {template.campaign_id && campaigns.find((c) => c.id === template.campaign_id) && (
                  <div className="absolute top-2 left-2">
                    <span
                      className="px-2 py-1 text-[10px] sm:text-xs font-medium rounded-full backdrop-blur-sm"
                      style={{
                        backgroundColor: `${campaigns.find((c) => c.id === template.campaign_id)?.color}30`,
                        color: campaigns.find((c) => c.id === template.campaign_id)?.color,
                      }}
                    >
                      {campaigns.find((c) => c.id === template.campaign_id)?.name}
                    </span>
                  </div>
                )}

                {/* Preview button on hover */}
                <button
                  onClick={() => setPreviewTemplate(template)}
                  className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-lg text-white/80 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4">
                <h3 className="font-medium text-lg text-white mb-1 group-hover:text-[#f5d5d5] transition-colors">
                  {template.name}
                </h3>
                {template.description && (
                  <p className="text-sm text-gray-400 line-clamp-2 mb-4">{template.description}</p>
                )}

                <Link href={`/templates/${template.id}/customize`} className="block">
                  <button className="w-full px-3 py-2.5 text-sm font-medium text-gray-900 bg-white hover:bg-gray-100 rounded-lg transition-colors">
                    Personalize
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="relative bg-[#1e1e1e] rounded-2xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div>
                <h3 className="font-medium text-white">{previewTemplate.name}</h3>
                {previewTemplate.description && (
                  <p className="text-sm text-gray-400 mt-0.5">{previewTemplate.description}</p>
                )}
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview Content - Rendered HTML */}
            <div className="bg-[#1a1a1a] flex items-center justify-center p-6" style={{ maxHeight: 'calc(90vh - 140px)', overflow: 'auto' }}>
              {previewTemplate.html_content ? (
                <div
                  className="bg-white shadow-2xl"
                  style={{
                    width: '408px', // 816 * 0.5
                    height: '528px', // 1056 * 0.5
                    borderRadius: '10px',
                    overflow: 'hidden',
                  }}
                >
                  <iframe
                    srcDoc={previewTemplate.html_content}
                    style={{
                      width: '816px',
                      height: '1056px',
                      border: 'none',
                      transform: 'scale(0.5)',
                      transformOrigin: 'top left',
                    }}
                    title="Template Preview"
                    sandbox="allow-same-origin"
                    scrolling="no"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center py-12 text-gray-500">
                  <span>No preview available</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-white/5">
              <Link href={`/templates/${previewTemplate.id}/customize`} className="block">
                <button className="w-full px-4 py-2.5 text-sm font-medium text-gray-900 bg-white hover:bg-gray-100 rounded-lg transition-colors">
                  Personalize This Design
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
