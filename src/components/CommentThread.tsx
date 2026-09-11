import { PaperPlaneTilt, ImageSquare, X } from '@phosphor-icons/react'
import React, { useState } from 'react'
import { hilosApi, uploadToHilos } from '../lib/hilosClient'

interface C { id: number; content: string; parentCommentId: number | null; createdAt: string; author: { handle: string; displayName?: string | null; avatarUrl?: string | null } }
interface Props { postId: number; initial: C[]; logged: boolean; total?: number }

// Enlaces, menciones y etiquetas navegables. Las URLs largas se muestran
// acortadas para que no rompan la columna de lectura.
function tokenize(text: string) {
  return (text || '').split(/(\s+)/).map((w, i) => {
    if (/^#[\p{L}\p{N}_]+$/u.test(w)) return <a key={i} href={`/tag/${w.slice(1)}`} className="text-blue hover:opacity-70">{w}</a>
    if (/^@[a-zA-Z0-9_]+$/.test(w)) return <a key={i} href={`/${w}`} data-hover-handle={w.slice(1)} className="text-blue hover:opacity-70">{w}</a>
    if (/^https?:\/\/\S+$/.test(w)) {
      let label = w
      try {
        const u = new URL(w)
        label = u.hostname.replace(/^www\./, '') + (u.pathname.length > 1 ? '/…' : '')
      } catch { label = w.slice(0, 40) + '…' }
      return <a key={i} href={w} target="_blank" rel="noopener nofollow" title={w} className="text-blue hover:opacity-70 break-all">{label}</a>
    }
    return <React.Fragment key={i}>{w}</React.Fragment>
  })
}

function splitMedia(content: string) {
  const lines = (content || '').split('\n')
  const imgs = lines.filter((l) => /^https?:\/\/\S+$/.test(l.trim()) && (/\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(l) || l.includes('r2.hilos.rest')))
  const text = lines.filter((l) => !imgs.includes(l)).join('\n').trim()
  return { text, imgs: imgs.map((i) => i.trim()) }
}
function ago(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'ahora'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`
  const h = Math.floor(s / 3600); if (h < 24) return `${h}h`
  return `${Math.floor(s / 86400)}d`
}

const Avatar = ({ c, size = 36 }: any) => (
  c?.avatarUrl
    ? <img src={c.avatarUrl} alt="" style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />
    : <div style={{ width: size, height: size, background: '#dbe8fb', color: 'var(--blue)' }} className="rounded-full flex items-center justify-center text-xs font-semibold shrink-0">{(c?.displayName || c?.handle || '?')[0]?.toUpperCase()}</div>
)

// Esqueleto con la silueta real de un comentario: avatar, nombre y dos lineas.
const CommentSkeleton = ({ nested = false }: { nested?: boolean }) => (
  <div className={nested ? 'mt-3 ml-10' : 'py-3'} style={nested ? undefined : { borderBottom: '1px solid var(--line)' }} aria-hidden>
    <div className="flex items-start gap-2.5">
      <div className="skeleton rounded-full shrink-0" style={{ width: nested ? 30 : 36, height: nested ? 30 : 36 }} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="skeleton h-3 rounded" style={{ width: '28%' }} />
        <div className="skeleton h-3.5 rounded" style={{ width: '88%' }} />
        <div className="skeleton h-3.5 rounded" style={{ width: '54%' }} />
      </div>
    </div>
  </div>
)

const CommentThread: React.FC<Props> = ({ postId, initial, logged, total = 0 }) => {
  const [items, setItems] = useState<C[]>(initial || [])
  const [loading, setLoading] = useState((initial || []).length === 0 && total > 0)

  React.useEffect(() => {
    if (!loading) return
    let alive = true
    hilosApi.comments(postId)
      .then((d: any) => { if (alive) setItems(Array.isArray(d) ? d : d?.items || []) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [postId, loading])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const [replyText, setReplyText] = useState('')
  const [image, setImage] = useState<{ preview: string; url: string | null; failed?: boolean } | null>(null)
  const fileInput = React.useRef<HTMLInputElement>(null)
  const [sort, setSort] = useState<'reciente' | 'antiguo' | 'popular'>('reciente')

  const pickImage = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { setImage({ preview: '', url: null, failed: true }); return }
    const preview = URL.createObjectURL(file)
    setImage({ preview, url: null })
    try {
      const url = await uploadToHilos(file)
      setImage({ preview, url })
    } catch { setImage({ preview, url: null, failed: true }) }
    if (fileInput.current) fileInput.current.value = ''
  }

  const clearImage = () => {
    if (image?.preview) URL.revokeObjectURL(image.preview)
    setImage(null)
  }
  const [sorting, setSorting] = useState(false)

  const changeSort = async (next: typeof sort) => {
    if (next === sort) return
    setSort(next); setSorting(true)
    try {
      const d: any = await hilosApi.commentsSorted(postId, next)
      setItems(Array.isArray(d) ? d : d?.items || [])
    } catch { /* nos quedamos con lo que ya había */ } finally { setSorting(false) }
  }

  const byParent = new Map<number, C[]>()
  for (const c of items) { const k = c.parentCommentId || 0; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k)!.push(c) }
  for (const [k, list] of byParent) {
    if (k === 0) continue
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }
  const roots = (byParent.get(0) || []).slice().sort((a, b) => {
    // Lo que acabas de escribir se queda arriba aunque aún no tenga fecha real.
    if (a.id < 0 || b.id < 0) return a.id < 0 ? -1 : 1
    return sort === 'antiguo'
      ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const needLogin = () => { window.location.href = '/auth/login' }

  const send = async (parentId?: number) => {
    if (!logged) return needLogin()
    const typed = (parentId ? replyText : text).trim()
    // La imagen solo acompaña al comentario principal, no a las respuestas.
    const attached = !parentId && image?.url ? image.url : null
    const content = [typed, attached].filter(Boolean).join('\n')
    if (!content || busy) return
    if (!parentId && image && !image.url && !image.failed) return // aún subiendo
    // Optimista: mostramos el comentario al instante y reconciliamos al responder el API.
    const tempId = -Date.now()
    const optimistic: any = { id: tempId, content, parentCommentId: parentId ?? null, createdAt: new Date().toISOString(), author: { handle: 'tu', displayName: 'Tú', avatarUrl: null }, pending: true }
    setItems((l) => [...l, optimistic])
    if (parentId) { setReplyText(''); setReplyTo(null) } else { setText(''); clearImage() }
    setBusy(true)
    try {
      const c = await hilosApi.comment(postId, content, parentId)
      setItems((l) => l.map((x) => (x.id === tempId ? c : x)))
    } catch {
      setItems((l) => l.filter((x) => x.id !== tempId))   // revertir
      if (parentId) setReplyText(typed); else setText(typed)
    } finally { setBusy(false) }
  }

  const Item = ({ c, nested = false, rootId }: { c: C; nested?: boolean; rootId?: number }) => {
    const { text: body, imgs } = splitMedia(c.content)
    const replies = byParent.get(c.id) || []
    return (
      <div className={nested ? "" : "py-3"} style={nested ? undefined : { borderBottom: "1px solid var(--line)" }}>
        <div className="flex items-start gap-2.5">
          <a href={`/@${c.author?.handle}`} data-hover-handle={c.author?.handle}><Avatar c={c.author} size={nested ? 30 : 36} /></a>
          <div className="min-w-0 flex-1">
            <p className="text-[13px]">
              <a href={`/@${c.author?.handle}`} data-hover-handle={c.author?.handle} className="font-semibold hover:opacity-70">{c.author?.displayName || c.author?.handle}</a>
              <span className="ink-3"> · {ago(c.createdAt)}</span>
            </p>
            {body && <p className="t-body whitespace-pre-wrap break-words mt-0.5">{tokenize(body)}</p>}
            {imgs.map((u, i) => (
              <img key={i} src={u} alt="Imagen del comentario" loading="lazy"
                data-lightbox="" data-lightbox-group={`comment-${c.id}`} data-src={u}
                className="mt-2 rounded-xl max-h-72 cursor-zoom-in" style={{ border: '1px solid var(--line)' }} />
            ))}
            <button type="button"
              onClick={() => {
                if (!logged) return needLogin()
                const target = nested ? (rootId ?? c.id) : c.id
                if (replyTo === target && nested && replyText.startsWith(`@${c.author?.handle} `)) { setReplyTo(null); setReplyText(''); return }
                if (replyTo === target && !nested) { setReplyTo(null); setReplyText(''); return }
                setReplyTo(target)
                // Al responder dentro de un hilo, dejamos la mención puesta.
                setReplyText(nested && c.author?.handle ? `@${c.author.handle} ` : '')
              }}
              className="mt-1.5 text-[13px] font-semibold cursor-pointer hover:opacity-70" style={{ color: "var(--blue)" }}>Responder</button>
            {replyTo === c.id && (
              <div className="mt-2 flex items-end gap-2">
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={1} autoFocus
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send(c.id) }}
                  placeholder={`Responder a ${c.author?.displayName || c.author?.handle}`}
                  className="flex-1 resize-none rounded-xl px-3.5 py-2.5 text-[15px] focus:outline-none" style={{ background: "#f5f8fd", border: "1px solid var(--line)" }} />
                <button type="button" onClick={() => send(c.id)} disabled={busy || !replyText.trim()}
                  className="btn disabled:opacity-35 cursor-pointer inline-flex items-center gap-1.5" aria-label="Responder"><PaperPlaneTilt size={16} weight="fill" />Responder</button>
              </div>
            )}
            {replies.length > 0 && (
              <div className="mt-4 pl-4 border-l-2 space-y-4" style={{ borderColor: "var(--line)" }}>
                {replies.map((r) => <Item key={r.id} c={r} nested rootId={c.id} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 py-3 flex-wrap">
        <h2 className="eyebrow">{items.length} {items.length === 1 ? 'comentario' : 'comentarios'}</h2>
        {items.length > 1 && (
          <div className="flex items-center gap-1.5">
            {([['reciente', 'Recientes'], ['antiguo', 'Antiguos'], ['popular', 'Populares']] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => changeSort(k)} disabled={sorting}
                className={`chip cursor-pointer ${sort === k ? 'is-on' : ''}`} style={{ padding: '5px 12px', fontSize: 13, minHeight: 0 }}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {logged ? (
        <div className="mb-4">
          {image && (
            <div className="relative inline-block mb-2 media" style={{ opacity: image.url ? 1 : 0.55 }}>
              {image.preview
                ? <img src={image.preview} alt="" className="max-h-40 rounded-xl" />
                : <span className="block px-4 py-3 t-caption" style={{ color: '#b42318' }}>La imagen supera los 5 MB</span>}
              {!image.url && !image.failed && <span className="absolute inset-0 skeleton rounded-xl" />}
              <button type="button" onClick={clearImage} aria-label="Quitar imagen"
                className="absolute top-1.5 right-1.5 grid place-items-center w-6 h-6 rounded-full cursor-pointer"
                style={{ background: 'rgba(16,31,56,.65)', color: '#fff' }}>
                <X size={12} weight="bold" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input ref={fileInput} type="file" accept="image/*" className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0])} />
            <button type="button" onClick={() => fileInput.current?.click()} disabled={!!image}
              aria-label="Adjuntar imagen" title={image ? 'Solo una imagen por comentario' : 'Adjuntar imagen'}
              className="act shrink-0 disabled:opacity-35 disabled:cursor-default cursor-pointer">
              <ImageSquare size={19} />
            </button>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send() }}
              onPaste={(e) => { const f = e.clipboardData.files?.[0]; if (f) { e.preventDefault(); pickImage(f) } }}
              placeholder="Súmate a la conversación"
              className="flex-1 resize-none rounded-xl px-3.5 py-2.5 text-[15px] focus:outline-none" style={{ background: "#f5f8fd", border: "1px solid var(--line)" }} />
            <button type="button" onClick={() => send()} disabled={busy || (!text.trim() && !image?.url) || (!!image && !image.url && !image.failed)}
              className="btn disabled:opacity-35 cursor-pointer shrink-0">Enviar</button>
          </div>
        </div>
      ) : (
        <a href="/auth/login" className="btn-ghost w-full justify-center my-2">Únete a la charca para comentar</a>
      )}
      {loading || sorting
        ? <div>{Array.from({ length: Math.min(4, Math.max(2, total)) }).map((_, i) => <CommentSkeleton key={i} />)}</div>
        : roots.length === 0
          ? <p className="t-sub py-8 text-center">Todavía no hay comentarios. Escribe el primero.</p>
          : roots.map((c) => <Item key={c.id} c={c} />)}
    </div>
  )
}
export default CommentThread
