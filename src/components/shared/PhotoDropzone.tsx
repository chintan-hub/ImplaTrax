import { useRef, useState } from 'react'
import { Camera, Loader2, X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { fileToResizedDataUrl } from '@/lib/imageResize'

interface PhotoDropzoneProps {
  label: string
  photos: string[]
  onChange: (photos: string[]) => void
  required?: boolean
  error?: string
  helpText?: string
  maxPhotos?: number
}

/**
 * Shared compact multi-photo attachment control — a row of square
 * thumbnails plus one dashed "add" tile, each thumbnail carrying its own
 * hover-revealed remove button. Used anywhere a transaction can carry photo
 * evidence (PO receipts, sales, loans, loan returns) so every one of those
 * dialogs looks and behaves identically.
 */
export function PhotoDropzone({ label, photos, onChange, required = false, error, helpText, maxPhotos = 6 }: PhotoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setUploading(true)
    try {
      const remaining = Math.max(0, maxPhotos - photos.length)
      const next = await Promise.all(files.slice(0, remaining).map((f) => fileToResizedDataUrl(f, 640)))
      onChange([...photos, ...next])
    } finally {
      setUploading(false)
    }
  }

  const removeAt = (i: number) => onChange(photos.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-danger-600"> *</span>}
      </Label>
      <div className="flex flex-wrap gap-2">
        {photos.map((src, i) => (
          <div key={i} className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border">
            <img src={src} alt={`Attachment ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Remove photo ${i + 1}`}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        ))}
        {photos.length < maxPhotos && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label="Add photo"
            className={cn(
              'flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground',
              error ? 'border-danger-400' : 'border-border',
            )}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
            <span className="text-[10px] font-medium">Add</span>
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" onChange={handleFiles} />
      </div>
      {error ? <p className="text-xs text-danger-600">{error}</p> : helpText ? <p className="text-xs text-muted-foreground">{helpText}</p> : null}
    </div>
  )
}
