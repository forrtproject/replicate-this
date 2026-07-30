import { useEffect, useRef, useState } from 'react'
import { Upload, X, ChevronDown, Smile } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { EMOJI_GROUPS } from './emoji'
import { useUpdateAvatar } from './api'

// A handful of the catalogue shown inline, so the common picks are one click away.
const QUICK_EMOJI = ['🔬', '🧪', '🧬', '🔭', '📊', '📈', '🧠', '⚗️', '🦠', '📚', '🤖', '🌌']

/** True when the stored avatar value is an inline image rather than an emoji. */
export function isImageAvatar(image: string | undefined): boolean {
  return !!image && image.startsWith('data:image/')
}

// Apple-style: emojis sit centered on a soft colored gradient circle. Pick a
// gradient deterministically from the emoji so each one gets a stable colour.
const EMOJI_GRADIENTS = [
  'linear-gradient(135deg, #60a5fa, #6366f1)',
  'linear-gradient(135deg, #f472b6, #db2777)',
  'linear-gradient(135deg, #34d399, #059669)',
  'linear-gradient(135deg, #fbbf24, #f97316)',
  'linear-gradient(135deg, #a78bfa, #7c3aed)',
  'linear-gradient(135deg, #22d3ee, #0891b2)',
  'linear-gradient(135deg, #f87171, #dc2626)',
  'linear-gradient(135deg, #94a3b8, #475569)',
]
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
      <span
        className={`${base} leading-none text-white shadow-inner`}
        style={{ background: gradientFor(image) }}
      >
        {image}
      </span>
    )
  }
  return (
    <span
      className={`${base} font-medium text-white`}
      style={{ background: gradientFor(name ?? '?') }}
    >
      {(name ?? '?').slice(0, 1).toUpperCase()}
    </span>
  )
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
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-sm font-medium hover:border-green disabled:opacity-60"
          >
            <Upload className="h-4 w-4" /> Upload image
          </button>
          {current && (
            <button
              type="button"
              onClick={() => {
                setEmoji('')
                save('')
              }}
              disabled={update.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-sm font-medium hover:border-destructive disabled:opacity-60"
            >
              <X className="h-4 w-4" /> Remove
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

      <div>
        <p className="mb-1.5 text-xs text-muted-foreground">Or pick an emoji</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => pick(e)}
              className={`rounded-full ring-offset-2 ring-offset-card transition-shadow hover:ring-2 hover:ring-green ${
                emoji === e ? 'ring-2 ring-green' : ''
              }`}
              aria-label={`Use ${e}`}
            >
              <AvatarBubble image={e} className="h-9 w-9 text-lg" />
            </button>
          ))}
          <EmojiPicker selected={emoji} onSelect={pick} />
        </div>
      </div>

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
        className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-sm font-medium hover:border-green"
      >
        <Smile className="h-4 w-4" />
        More emojis
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
