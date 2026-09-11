import React, { useRef, useState } from 'react'
import { ImageSquare, X } from '@phosphor-icons/react'
import { hilosApi, uploadToHilos } from '../lib/hilosClient'

interface Props {
  user: { handle: string; displayName?: string | null; avatarUrl?: string | null }
  onOptimistic?: (tempId: number, content: string) => void
  onPosted?: (tempId: number, post: any) => void
  onFailed?: (tempId: number) => void
}

const LIMIT = 5000
const MAX_IMAGES = 4
const MAX_SIZE = 5 * 1024 * 1024

interface Attachment { id: string; preview: string; url: string | null; failed?: boolean }

const Composer: React.FC<Props> = ({ user, onOptimistic, onPosted, onFailed }) => {
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [images, setImages] = useState<Attachment[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const left = LIMIT - content.length
  const over = left < 0
  const uploading = images.some((i) => !i.url && !i.failed)
  const canPost = (content.trim() || images.some((i) => i.url)) && !over && !uploading && !busy

  const pick = async (files: FileList | null) => {
    if (!files?.length) return
    setErr(null)
    const room = MAX_IMAGES - images.length
    if (room <= 0) { setErr(`Puedes adjuntar hasta ${MAX_IMAGES} imágenes.`); return }

    const chosen = Array.from(files).slice(0, room)
    if (files.length > room) setErr(`Solo caben ${MAX_IMAGES} imágenes por publicación.`)

    for (const file of chosen) {
      if (!file.type.startsWith('image/')) { setErr('Solo se pueden adjuntar imágenes.'); continue }
      if (file.size > MAX_SIZE) { setErr('Cada imagen debe pesar menos de 5 MB.'); continue }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const preview = URL.createObjectURL(file)
      setImages((l) => [...l, { id, preview, url: null }])
      try {
        const url = await uploadToHilos(file)
        setImages((l) => l.map((i) => (i.id === id ? { ...i, url } : i)))
      } catch {
        setImages((l) => l.map((i) => (i.id === id ? { ...i, failed: true } : i)))
        setErr('No se pudo subir una de las imágenes.')
      }
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  const remove = (id: string) => {
    setImages((l) => {
      const gone = l.find((i) => i.id === id)
      if (gone) URL.revokeObjectURL(gone.preview)
      return l.filter((i) => i.id !== id)
    })
  }

  const submit = async () => {
    const text = content.trim()
    const urls = images.filter((i) => i.url).map((i) => i.url!)
    if ((!text && !urls.length) || busy || over || uploading) return
    setErr(null)

    // Las imágenes viajan en el propio texto: así se ven igual en cualquier
    // cliente del motor social, sin depender de un campo aparte.
    const body = [text, ...urls].filter(Boolean).join('\n')

    const tempId = -Date.now()
    if (onOptimistic) {
      onOptimistic(tempId, body)
      setContent(''); images.forEach((i) => URL.revokeObjectURL(i.preview)); setImages([])
    } else setBusy(true)

    try {
      const post = await hilosApi.createPost(body)
      if (onPosted) onPosted(tempId, post)
      else window.location.reload()
    } catch (e: any) {
      onFailed?.(tempId)
      setContent(text)
      setErr(e?.message === 'rate_limited' ? 'Vas muy rápido, espera un momento.' : 'No se pudo publicar. Inténtalo de nuevo.')
      setBusy(false)
    }
  }

  return (
    <div className="flex gap-3.5">
      {user.avatarUrl
        ? <img src={user.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
        : <span className="grid place-items-center w-11 h-11 rounded-full text-[15px] font-semibold shrink-0" style={{ background: '#dbe8fb', color: 'var(--blue)' }}>{(user.displayName || user.handle)[0]?.toUpperCase()}</span>}

      <div className="flex-1 min-w-0">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit() }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files || [])
            if (files.length) { e.preventDefault(); pick(e.clipboardData.files) }
          }}
          rows={2}
          placeholder="¿Qué cuentas hoy?"
          aria-label="Escribe una publicación"
          className="w-full resize-none bg-transparent text-[19px] tracking-[-0.02em] placeholder-[color:var(--ink-3)] focus:outline-none"
        />

        {images.length > 0 && (
          <div className={`grid gap-2 mt-2 mb-1 ${images.length > 1 ? 'grid-cols-2' : ''}`}>
            {images.map((img) => (
              <div key={img.id}
                className={`relative media post-media ${images.length > 1 ? 'post-media--grid' : ''}`}
                style={{ opacity: img.url ? 1 : 0.55, cursor: 'default', ['--media-bg' as any]: `url('${img.preview}')` }}>
                {/* La previsualización enseña la imagen entera: así se ve igual
                    que cuando quede publicada. */}
                <img src={img.preview} alt="" style={{ maxHeight: images.length > 1 ? undefined : 360 }} />
                {!img.url && !img.failed && <span className="absolute inset-0 skeleton" />}
                {img.failed && (
                  <span className="absolute inset-0 grid place-items-center text-[12px] font-medium" style={{ background: 'rgba(180,35,24,.12)', color: '#b42318' }}>
                    No se pudo subir
                  </span>
                )}
                <button type="button" onClick={() => remove(img.id)} aria-label="Quitar imagen"
                  className="absolute top-2 right-2 grid place-items-center w-7 h-7 rounded-full cursor-pointer"
                  style={{ background: 'rgba(16,31,56,.65)', color: '#fff' }}>
                  <X size={14} weight="bold" />
                </button>
              </div>
            ))}
          </div>
        )}

        {err && <p className="t-caption mb-2" style={{ color: '#b42318' }}>{err}</p>}

        <div className="flex items-center justify-between gap-3 mt-1">
          <input ref={fileInput} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => pick(e.target.files)} />
          <button type="button" onClick={() => fileInput.current?.click()}
            disabled={images.length >= MAX_IMAGES}
            title={images.length >= MAX_IMAGES ? `Máximo ${MAX_IMAGES} imágenes` : 'Añadir imágenes'}
            aria-label="Añadir imágenes"
            className="act disabled:opacity-35 disabled:cursor-default cursor-pointer">
            <ImageSquare size={20} />
            {images.length > 0 && <span className="tabular-nums text-[13px]">{images.length}/{MAX_IMAGES}</span>}
          </button>

          <div className="flex items-center gap-3">
            {content.length > LIMIT - 500 && (
              <span className="text-[12px] tabular-nums" style={{ color: over ? '#b42318' : 'var(--ink-3)' }}>{left}</span>
            )}
            <button type="button" onClick={submit} disabled={!canPost}
              className="btn disabled:opacity-35 disabled:cursor-default cursor-pointer">
              {busy ? 'Publicando…' : uploading ? 'Subiendo…' : 'Publicar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
export default Composer
