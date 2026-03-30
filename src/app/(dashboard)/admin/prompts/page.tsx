'use client'

import { useState, useEffect } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface SystemPrompt {
  id: string
  name: string
  description: string | null
  prompt_content: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function AdminPromptsPage() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Edit/Create modal state
  const [showModal, setShowModal] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prompt_content: '',
    is_active: true,
  })
  const [isSaving, setIsSaving] = useState(false)

  const fetchPrompts = async () => {
    try {
      const response = await fetch('/api/prompts?includeInactive=true')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch prompts')
      }

      setPrompts(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPrompts()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt? This action cannot be undone.')) {
      return
    }

    setDeletingId(id)

    try {
      const response = await fetch(`/api/prompts/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to delete prompt')
      }

      setPrompts((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete prompt')
    } finally {
      setDeletingId(null)
    }
  }

  const openCreateModal = () => {
    setEditingPrompt(null)
    setFormData({
      name: '',
      description: '',
      prompt_content: '',
      is_active: true,
    })
    setShowModal(true)
  }

  const openEditModal = (prompt: SystemPrompt) => {
    setEditingPrompt(prompt)
    setFormData({
      name: prompt.name,
      description: prompt.description || '',
      prompt_content: prompt.prompt_content,
      is_active: prompt.is_active,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.prompt_content.trim()) {
      setError('Name and prompt content are required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const url = editingPrompt
        ? `/api/prompts/${editingPrompt.id}`
        : '/api/prompts'

      const response = await fetch(url, {
        method: editingPrompt ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          prompt_content: formData.prompt_content,
          is_active: formData.is_active,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save prompt')
      }

      if (editingPrompt) {
        setPrompts((prev) =>
          prev.map((p) => (p.id === editingPrompt.id ? result.data : p))
        )
      } else {
        setPrompts((prev) => [result.data, ...prev])
      }

      setShowModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save prompt')
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
        <div>
          <h1 className="text-2xl font-semibold text-foreground">System Prompts</h1>
          <p className="mt-1 text-muted-foreground">
            Create and manage system prompts for templates
          </p>
        </div>
        <Button onClick={openCreateModal} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Prompt
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-5 py-4 mb-6">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {prompts.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <p className="text-muted-foreground mb-4">No prompts yet</p>
          <Button onClick={openCreateModal}>
            Create your first prompt
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className="bg-card rounded-xl border border-border overflow-hidden"
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => setExpandedId(expandedId === prompt.id ? null : prompt.id)}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-foreground font-medium">{prompt.name}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          prompt.is_active
                            ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30'
                            : 'bg-secondary text-muted-foreground border border-border'
                        }`}
                      >
                        {prompt.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {prompt.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{prompt.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(prompt.updated_at)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openEditModal(prompt)
                    }}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(prompt.id)
                    }}
                    disabled={deletingId === prompt.id}
                    className="p-2 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deletingId === prompt.id ? (
                      <Spinner size="sm" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                  {expandedId === prompt.id ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {expandedId === prompt.id && (
                <div className="px-5 pb-4 border-t border-border">
                  <div className="mt-4">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Prompt Content
                    </Label>
                    <pre className="mt-2 p-4 bg-muted rounded-lg text-sm text-foreground whitespace-pre-wrap font-mono overflow-x-auto max-h-96 overflow-y-auto">
                      {prompt.prompt_content}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                {editingPrompt ? 'Edit Prompt' : 'Create New Prompt'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Real Estate Marketing Prompt"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this prompt"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prompt_content">Prompt Content</Label>
                <Textarea
                  id="prompt_content"
                  value={formData.prompt_content}
                  onChange={(e) => setFormData({ ...formData, prompt_content: e.target.value })}
                  placeholder="Enter the system prompt content..."
                  rows={12}
                  className="font-mono text-sm resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-border bg-background text-primary focus:ring-primary/50"
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Active (available for selection)
                </Label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setShowModal(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {editingPrompt ? 'Save Changes' : 'Create Prompt'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
