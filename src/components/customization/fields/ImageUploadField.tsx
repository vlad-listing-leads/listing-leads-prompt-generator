'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { TemplateField } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { ImageCropperModal } from '@/components/ui/ImageCropperModal'
import { Upload, X, Link as LinkIcon } from 'lucide-react'

interface ImageUploadFieldProps {
  field: TemplateField
  value: string
  onChange: (value: string) => void
  error?: string
  uploadOnly?: boolean
  previewSize?: { width: number; height: number } | 'default'
  requireCrop?: boolean
  cropAspectRatio?: number
}

export function ImageUploadField({
  field,
  value,
  onChange,
  error,
  uploadOnly = false,
  previewSize = 'default',
  requireCrop = false,
  cropAspectRatio = 1
}: ImageUploadFieldProps) {
  const [inputMode, setInputMode] = useState<'url' | 'upload'>('upload')
  const [previewError, setPreviewError] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [cropperFile, setCropperFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUrlChange = (url: string) => {
    setPreviewError(false)
    setUploadError(null)
    onChange(url)
  }

  const uploadFile = async (fileOrBlob: File | Blob) => {
    setIsUploading(true)
    setUploadError(null)
    setPreviewError(false)

    try {
      const formData = new FormData()
      formData.append('file', fileOrBlob)
      formData.append('folder', '/_personalization')

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

    setUploadError(null)

    // If cropping is required, open the cropper modal
    if (requireCrop) {
      setCropperFile(file)
      // Reset file input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // Otherwise, upload directly
    await uploadFile(file)
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    setCropperFile(null)
    await uploadFile(croppedBlob)
  }

  const handleCropCancel = () => {
    setCropperFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
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

      {/* Mode Toggle - only show if not uploadOnly */}
      {!uploadOnly && (
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
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        id={`${field.field_key}-upload`}
      />

      {/* Compact layout for uploadOnly with custom preview size */}
      {uploadOnly && previewSize !== 'default' ? (
        <div className="flex items-center gap-3 mt-2">
          {/* Preview */}
          {value ? (
            <div className="relative">
              <div
                className="relative bg-[#2a2a2a] rounded-lg overflow-hidden flex items-center justify-center"
                style={{ width: previewSize.width, height: previewSize.height, padding: '10%' }}
              >
                {previewError ? (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">
                    Failed
                  </div>
                ) : (
                  <Image
                    src={value}
                    alt="Preview"
                    width={Math.round(previewSize.width * 0.8)}
                    height={Math.round(previewSize.height * 0.8)}
                    className="object-contain"
                    onError={() => setPreviewError(true)}
                  />
                )}
              </div>
              <button
                type="button"
                onClick={clearImage}
                className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ) : (
            <div
              className="bg-[#2a2a2a] rounded-lg border border-white/10"
              style={{ width: previewSize.width, height: previewSize.height }}
            />
          )}
          {/* Upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="h-9 px-4 text-sm font-medium bg-[#2a2a2a] text-white border border-white/10 hover:bg-[#333] rounded-lg transition-colors disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : value ? 'Change' : 'Upload'}
          </button>
        </div>
      ) : !uploadOnly && inputMode === 'url' ? (
        <Input
          id={field.field_key}
          type="url"
          value={value}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder={field.placeholder || 'https://example.com/image.jpg'}
          error={!!error}
        />
      ) : (
        <>
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
          {/* Preview for default layout */}
          {value && (
            <div className="relative mt-2 inline-block">
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
                className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Upload Error */}
      {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Image Cropper Modal */}
      {cropperFile && (
        <ImageCropperModal
          imageFile={cropperFile}
          aspectRatio={cropAspectRatio}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  )
}
