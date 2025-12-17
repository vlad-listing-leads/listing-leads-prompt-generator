'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TemplateWithSystemPrompt } from '@/types'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, Eye, GripVertical } from 'lucide-react'
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
  onDelete: (id: string) => void
  deletingId: string | null
}

function SortableRow({ template, onDelete, deletingId }: SortableRowProps) {
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
            onClick={() => onDelete(template.id)}
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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
      return
    }

    setDeletingId(id)

    try {
      const response = await fetch(`/api/templates/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to delete template')
      }

      setTemplates((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template')
    } finally {
      setDeletingId(null)
    }
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
                      onDelete={handleDelete}
                      deletingId={deletingId}
                    />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </DndContext>
        </div>
      )}
    </div>
  )
}
