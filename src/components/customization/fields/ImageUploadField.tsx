'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { TemplateField } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Upload, X, Link as LinkIcon } from 'lucide-react'

interface ImageUploadFieldProps {
  field: TemplateField
  value: string
  onChange: (value: string) => void
  error?: string
}

export function ImageUploadField({ field, value, onChange, error }: ImageUploadFieldProps) {
  const [inputMode, setInputMode] = useState<'url' | 'upload'>('upload')
  const [previewError, setPreviewError] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUrlChange = (url: string) => {
    setPreviewError(false)
    setUploadError(null)
    onChange(url)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image must be less than 10MB')
      return
    }

    setIsUploading(true)
    setUploadError(null)
    setPreviewError(false)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', '/customizations')

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      onChange(result.url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setIsUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const clearImage = () => {
    onChange('')
    setPreviewError(false)
    setUploadError(null)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={field.field_key} required={field.is_required}>
        {field.label}
      </Label>

      {/* Mode Toggle */}
      <div className="flex gap-1 mb-2">
        <button
          type="button"
          onClick={() => setInputMode('upload')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            inputMode === 'upload'
              ? 'bg-[#f5d5d5] text-gray-900'
              : 'bg-[#2a2a2a] text-gray-400 hover:text-white'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          Upload
        </button>
        <button
          type="button"
          onClick={() => setInputMode('url')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            inputMode === 'url'
              ? 'bg-[#f5d5d5] text-gray-900'
              : 'bg-[#2a2a2a] text-gray-400 hover:text-white'
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          URL
        </button>
      </div>

      {inputMode === 'url' ? (
        <Input
          id={field.field_key}
          type="url"
          value={value}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder={field.placeholder || 'https://example.com/image.jpg'}
          error={!!error}
        />
      ) : (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id={`${field.field_key}-upload`}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-xl transition-colors ${
              error
                ? 'border-red-500/50 hover:border-red-500'
                : 'border-white/10 hover:border-[#f5d5d5]/50 hover:bg-white/5'
            } text-gray-400 hover:text-white`}
          >
            {isUploading ? (
              <>
                <Spinner size="sm" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Click to upload image
              </>
            )}
          </button>
        </div>
      )}

      {/* Upload Error */}
      {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}

      {/* Preview */}
      {value && (
        <div className="relative mt-2">
          <div className="relative aspect-video w-full max-w-xs bg-[#2a2a2a] rounded-xl overflow-hidden">
            {previewError ? (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                Failed to load image
              </div>
            ) : (
              <Image
                src={value}
                alt="Preview"
                fill
                className="object-cover"
                onError={() => setPreviewError(true)}
              />
            )}
          </div>
          <button
            type="button"
            onClick={clearImage}
            className="absolute top-2 right-2 p-1 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
