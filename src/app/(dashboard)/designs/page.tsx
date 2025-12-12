'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Customization, Template, Campaign } from '@/types'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDateTime } from '@/lib/utils'
import { Plus, Pencil, Trash2, Eye, ExternalLink, X, LayoutTemplate, ChevronRight, Search, FolderOpen } from 'lucide-react'

interface TemplateWithCampaign extends Template {
  campaign_id?: string | null
  campaign?: { id: string; name: string; color: string } | null
}

interface CustomizationWithTemplate extends Customization {
  template: Pick<TemplateWithCampaign, 'id' | 'name' | 'thumbnail_url' | 'campaign_id'>
}

export default function MyDesignsPage() {
  const router = useRouter()
  const [customizations, setCustomizations] = useState<CustomizationWithTemplate[]>([])
  const [templates, setTemplates] = useState<TemplateWithCampaign[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState<string | null>(null)

  const fetchCustomizations = async () => {
    try {
      const response = await fetch('/api/customizations')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch designs')
      }

      setCustomizations(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTemplates = async () => {
    setIsLoadingTemplates(true)
    try {
      const response = await fetch('/api/templates')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch templates')
      }

      setTemplates(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch campaigns')
      }

      setCampaigns(result.data || [])
    } catch (err) {
      console.error('Error fetching campaigns:', err)
    }
  }

  useEffect(() => {
    fetchCustomizations()
  }, [])

  const handleCreateNew = () => {
    setShowTemplateModal(true)
    setSelectedCampaignFilter(null)
    setTemplateSearch('')
    if (templates.length === 0 || campaigns.length === 0) {
      fetchTemplates()
      fetchCampaigns()
    }
  }

  const handleSelectTemplate = (templateId: string) => {
    setShowTemplateModal(false)
    router.push(`/templates/${templateId}/customize`)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this design?')) return

    setDeletingId(id)

    try {
      const response = await fetch(`/api/customizations/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to delete')
      }

      setCustomizations((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
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
    <div className="px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white">My Designs</h1>
          <p className="mt-1 text-sm sm:text-base text-gray-400">
            Manage your customized listing designs
          </p>
        </div>
        <Button onClick={handleCreateNew} variant="primary" className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Create New Design
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 mb-6">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {customizations.length === 0 ? (
        <div className="text-center py-12 sm:py-16 bg-[#1e1e1e] rounded-2xl border border-white/5">
          <LayoutTemplate className="w-10 sm:w-12 h-10 sm:h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4 px-4">You haven&apos;t created any designs yet</p>
          <Button onClick={handleCreateNew} variant="primary" className="mx-4">
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Design
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {customizations.map((customization) => (
              <div key={customization.id} className="bg-[#1e1e1e] rounded-2xl border border-white/5 overflow-hidden hover:border-white/10 transition-all group">
                <div className="relative aspect-video bg-[#2a2a2a]">
                  {(customization.thumbnail_url || customization.template?.thumbnail_url) ? (
                    <Image
                      src={customization.thumbnail_url || customization.template?.thumbnail_url || ''}
                      alt={customization.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                      <span className="text-sm">No preview</span>
                    </div>
                  )}
                  <span
                    className={`absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-full ${
                      customization.status === 'published'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    }`}
                  >
                    {customization.status}
                  </span>
                </div>

                <div className="p-4">
                  <h3 className="font-medium text-lg text-white mb-1 group-hover:text-[#f5d5d5] transition-colors">
                    {customization.name}
                  </h3>
                  <p className="text-sm text-gray-400">
                    Based on: {customization.template?.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Last updated: {formatDateTime(customization.updated_at)}
                  </p>

                  <div className="flex gap-2 mt-4">
                    <Link href={`/designs/${customization.id}`} className="flex-1">
                      <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-gray-900 bg-white hover:bg-gray-100 rounded-lg transition-colors font-medium">
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                    </Link>

                    {customization.status === 'published' && customization.published_url && (
                      <Link href={customization.published_url}>
                        <button className="p-2 text-gray-400 hover:text-white bg-[#2a2a2a] hover:bg-[#333] rounded-lg transition-colors">
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </Link>
                    )}

                    <Link href={`/preview/${customization.id}`}>
                      <button className="p-2 text-gray-400 hover:text-white bg-[#2a2a2a] hover:bg-[#333] rounded-lg transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </Link>

                    <button
                      onClick={() => handleDelete(customization.id)}
                      disabled={deletingId === customization.id}
                      className="p-2 text-red-400 hover:text-red-300 bg-[#2a2a2a] hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deletingId === customization.id ? (
                        <Spinner size="sm" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e1e1e] rounded-t-2xl sm:rounded-2xl border border-white/10 w-full sm:max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden shadow-2xl flex flex-col sm:mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 flex-shrink-0">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-white">Create New Design</h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
                  Select a template to start
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTemplateModal(false)
                  setTemplateSearch('')
                }}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search and Campaign Filter */}
            <div className="px-4 pt-3 sm:pt-4 flex-shrink-0 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="pl-10"
                  autoFocus
                />
              </div>

              {/* Campaign Filter Pills - Horizontal scroll on mobile */}
              {campaigns.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-hide">
                  <button
                    onClick={() => setSelectedCampaignFilter(null)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap flex-shrink-0 ${
                      selectedCampaignFilter === null
                        ? 'bg-white text-gray-900'
                        : 'bg-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#333]'
                    }`}
                  >
                    All Templates
                  </button>
                  {campaigns.map((campaign) => (
                    <button
                      key={campaign.id}
                      onClick={() => setSelectedCampaignFilter(campaign.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                        selectedCampaignFilter === campaign.id
                          ? 'bg-white text-gray-900'
                          : 'bg-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#333]'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: campaign.color }}
                      />
                      {campaign.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto flex-1">
              {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400">No templates available</p>
                </div>
              ) : (
                <>
                  {(() => {
                    // Filter by campaign first, then by search
                    let filteredTemplates = templates

                    if (selectedCampaignFilter) {
                      filteredTemplates = filteredTemplates.filter(
                        (template) => template.campaign_id === selectedCampaignFilter
                      )
                    }

                    filteredTemplates = filteredTemplates.filter((template) =>
                      template.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
                      template.description?.toLowerCase().includes(templateSearch.toLowerCase())
                    )

                    if (filteredTemplates.length === 0) {
                      return (
                        <div className="text-center py-12">
                          <Search className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                          <p className="text-gray-400">No templates match your search</p>
                        </div>
                      )
                    }

                    return (
                      <div className="space-y-2">
                        {filteredTemplates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => handleSelectTemplate(template.id)}
                            className="w-full flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-xl border bg-[#2a2a2a] border-white/5 hover:border-[#f5d5d5]/50 hover:bg-[#333] transition-all text-left group"
                          >
                            <div className="relative w-20 h-14 sm:w-32 sm:h-20 rounded-lg overflow-hidden bg-[#1a1a1a] flex-shrink-0">
                              {template.thumbnail_url ? (
                                <Image
                                  src={template.thumbnail_url}
                                  alt={template.name}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                                  <LayoutTemplate className="w-5 sm:w-6 h-5 sm:h-6" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <h3 className="font-medium text-sm sm:text-base text-white group-hover:text-[#f5d5d5] transition-colors">
                                  {template.name}
                                </h3>
                                {template.campaign_id && campaigns.find(c => c.id === template.campaign_id) && (
                                  <span
                                    className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs rounded-full"
                                    style={{
                                      backgroundColor: `${campaigns.find(c => c.id === template.campaign_id)?.color}20`,
                                      color: campaigns.find(c => c.id === template.campaign_id)?.color,
                                    }}
                                  >
                                    {campaigns.find(c => c.id === template.campaign_id)?.name}
                                  </span>
                                )}
                              </div>
                              {template.description && (
                                <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1 line-clamp-1 sm:line-clamp-2">
                                  {template.description}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0 text-gray-600 group-hover:text-[#f5d5d5] transition-colors" />
                          </button>
                        ))}
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
