import { useEffect, useRef, useState } from 'react'
import { Upload, ChevronDown, Smile } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { EMOJI_GROUPS } from './emoji'
import { useUpdateAvatar } from './api'


/** True when the stored avatar value is an inline image rather than an emoji. */
function isImageAvatar(image: string | undefined): boolean {
  return !!image && image.startsWith('data:image/')
}

// Emojis and initials sit on a flat, muted tint drawn from the site palette.
// The tint is picked deterministically from the emoji or name, so it is stable.
const EMOJI_GRADIENTS = ['#dcebe3', '#ebe5d6', '#dfe5ec', '#ecdfdc', '#e3e0ec', '#e2e8d8']
function gradientFor(seed: string): string {
  let hash = 0
  for (const ch of seed) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0
  return EMOJI_GRADIENTS[hash % EMOJI_GRADIENTS.length]
}

/** Read-only avatar bubble — an image, an emoji on a colored circle, or a lettered fallback. */
export function AvatarBubble({
  image,
  name,
  className = 'h-16 w-16 text-3xl',
}: {
  image?: string
  name?: string | null
  className?: string
}) {
  const base = `inline-flex items-center justify-center overflow-hidden rounded-full ${className}`
  if (isImageAvatar(image)) {
    return <img src={image} alt="" className={`${base} border border-line object-cover`} />
  }
  if (image) {
    return (
      <span className={`${base} leading-none`} style={{ background: gradientFor(image) }}>
        {image}
      </span>
    )
  }
  return (
    <span
      className={`${base} font-display font-semibold text-ink/75`}
      style={{ background: gradientFor(name ?? '?') }}
    >
      {initial(name)}
    </span>
  )
}

/** First letter of the name, skipping academic titles ("Dr. Jane Cortez" → "J"). */
function initial(name: string | null | undefined): string {
  const words = (name ?? '?').trim().split(/\s+/)
  const first = words.find((w) => !/^(dr|prof|professor|mr|mrs|ms|mx)\.?$/i.test(w)) ?? words[0]
  return (first || '?').slice(0, 1).toUpperCase()
}

/** Downscale an uploaded image to a small inline data URL (keeps it under the cap). */
function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That file is not a valid image.'))
      img.onload = () => {
        const max = 256
        const scale = Math.min(max / img.width, max / img.height, 1)
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Could not process that image.'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

/** Emoji-or-upload avatar editor. Self-contained: saves via the profile API. */
export function AvatarEditor({ current, name }: { current: string; name?: string | null }) {
  const update = useUpdateAvatar()
  const [error, setError] = useState('')
  const [emoji, setEmoji] = useState(isImageAvatar(current) ? '' : current)
  const fileRef = useRef<HTMLInputElement>(null)

  function save(image: string) {
    setError('')
    update.mutate(image, {
      onError: (e) =>
        setError(e instanceof ApiError ? e.message : 'Could not update your avatar.'),
    })
  }

  function pick(value: string) {
    setEmoji(value)
    save(value)
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setError('')
    try {
      save(await fileToAvatarDataUrl(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process that image.')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <AvatarBubble image={current} name={name} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={update.isPending}
            className="btn-secondary"
          >
            <Upload className="h-4 w-4" aria-hidden /> Upload a photo
          </button>
          <EmojiPicker selected={emoji} onSelect={pick} />
          {current && (
            <button
              type="button"
              onClick={() => {
                setEmoji('')
                save('')
              }}
              disabled={update.isPending}
              className="px-2 text-sm text-muted-foreground hover:text-destructive"
            >
              Use initial
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>

      <p className="text-xs text-muted-foreground">A new picture is saved as soon as you choose it.</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

/** Dropdown over the full emoji catalogue, grouped by theme. */
function EmojiPicker({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (emoji: string) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close on an outside click or Escape, like any other menu on the page.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="btn-secondary"
      >
        <Smile className="h-4 w-4" aria-hidden />
        Choose an emoji
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose an emoji"
          className="absolute left-0 z-30 mt-1.5 max-h-80 w-76 overflow-y-auto rounded-lg border border-line bg-card p-3 shadow-lg"
        >
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="mb-3 last:mb-0">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{group.label}</p>
              <div className="grid grid-cols-8 gap-1">
                {group.emojis.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      onSelect(e)
                      setOpen(false)
                    }}
                    aria-label={`Use ${e}`}
                    aria-pressed={selected === e}
                    className={`flex h-8 w-8 items-center justify-center rounded-md text-xl leading-none hover:bg-muted ${
                      selected === e ? 'bg-green-tint ring-1 ring-green' : ''
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
