'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TemplateWithSystemPrompt } from '@/types'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, Eye, GripVertical, X, AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatDateTime } from '@/lib/utils'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SortableRowProps {
  template: TemplateWithSystemPrompt
  onDeleteClick: (id: string) => void
  deletingId: string | null
}

function SortableRow({ template, onDeleteClick, deletingId }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: template.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-accent/50 transition-colors ${isDragging ? 'bg-accent' : ''}`}
    >
      <td className="px-3 py-4 w-10">
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center">
          {template.thumbnail_url && (
            <div className="flex-shrink-0 h-10 w-16 mr-4">
              <img
                className="h-10 w-16 rounded-lg object-cover"
                src={template.thumbnail_url}
                alt=""
              />
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              {template.artifact_url && (
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: '#D97857' }}
                  title="Has Claude artifact"
                />
              )}
              <span className="text-sm font-medium text-foreground">
                {template.name}
              </span>
            </div>
            {template.description && (
              <div className="text-sm text-muted-foreground truncate max-w-xs">
                {template.description}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">
        {template.system_prompt?.name || '—'}
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            template.is_active
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-gray-100 text-gray-600 border border-gray-200'
          }`}
        >
          {template.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">
        {formatDateTime(template.updated_at)}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end gap-1">
          <Link href={`/templates/${template.id}/customize`}>
            <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
              <Eye className="w-4 h-4" />
            </button>
          </Link>
          <Link href={`/admin/templates/${template.id}/edit`}>
            <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
          </Link>
          <button
            onClick={() => onDeleteClick(template.id)}
            disabled={deletingId === template.id}
            className="p-2 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
          >
            {deletingId === template.id ? (
              <Spinner size="sm" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateWithSystemPrompt[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isSavingOrder, setIsSavingOrder] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<TemplateWithSystemPrompt | null>(null)
  const [confirmText, setConfirmText] = useState('')

  const CONFIRM_PHRASE = 'Keep cranking'

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates?includeInactive=true')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch templates')
      }

      setTemplates(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const handleDeleteClick = (id: string) => {
    const template = templates.find((t) => t.id === id)
    if (template) {
      setTemplateToDelete(template)
      setConfirmText('')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!templateToDelete || confirmText !== CONFIRM_PHRASE) return

    setDeletingId(templateToDelete.id)

    try {
      const response = await fetch(`/api/templates/${templateToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to delete template')
      }

      setTemplates((prev) => prev.filter((t) => t.id !== templateToDelete.id))
      setTemplateToDelete(null)
      setConfirmText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteCancel = () => {
    setTemplateToDelete(null)
    setConfirmText('')
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = templates.findIndex((t) => t.id === active.id)
      const newIndex = templates.findIndex((t) => t.id === over.id)

      const newTemplates = arrayMove(templates, oldIndex, newIndex)
      setTemplates(newTemplates)

      // Save the new order to the server
      setIsSavingOrder(true)
      try {
        const response = await fetch('/api/templates/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateIds: newTemplates.map((t) => t.id),
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to save order')
        }
      } catch (err) {
        console.error('Error saving order:', err)
        // Revert on error
        setTemplates(templates)
        setError('Failed to save template order')
      } finally {
        setIsSavingOrder(false)
      }
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
          <h1 className="text-2xl font-semibold text-foreground">Manage Templates</h1>
          <p className="mt-1 text-muted-foreground">
            Create, edit, and manage your page templates. Drag to reorder.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isSavingOrder && (
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Spinner size="sm" />
              Saving...
            </span>
          )}
          <Link href="/admin/templates/new">
            <Button>
              <Plus className="w-4 h-4" />
              New Template
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-5 py-4 mb-6">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <p className="text-muted-foreground mb-4">No templates yet</p>
          <Link href="/admin/templates/new">
            <Button>Create your first template</Button>
          </Link>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-4 w-10"></th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Template
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    System Prompt
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th className="px-4 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <SortableContext
                  items={templates.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {templates.map((template) => (
                    <SortableRow
                      key={template.id}
                      template={template}
                      onDeleteClick={handleDeleteClick}
                      deletingId={deletingId}
                    />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </DndContext>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {templateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleDeleteCancel}
          />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <button
              onClick={handleDeleteCancel}
              className="absolute top-4 right-4 p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-destructive/10 rounded-full">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Delete Template</h2>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete <span className="font-medium text-foreground">{templateToDelete.name}</span>? This action cannot be undone.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-2">
                Type <span className="font-semibold text-destructive">{CONFIRM_PHRASE}</span> to confirm
              </label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                className="w-full"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleDeleteCancel}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={confirmText !== CONFIRM_PHRASE || deletingId === templateToDelete.id}
                className="flex-1"
              >
                {deletingId === templateToDelete.id ? (
                  <>
                    <Spinner size="sm" />
                    Deleting...
                  </>
                ) : (
                  'Delete Template'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
