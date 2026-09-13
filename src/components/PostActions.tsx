import React, { useEffect, useState } from 'react'
import { ChatCircle, Heart, BookmarkSimple, ShareNetwork, LinkSimple, Check, Trash } from '@phosphor-icons/react'
import { hilosApi, getIdentity } from '../lib/hilosClient'

interface C { id: number; content: string; parentCommentId: number | null; createdAt: string; author: { handle: string; displayName?: string | null; avatarUrl?: string | null } }
interface Props {
  postId: number; likes: number; comments: number
  liked?: boolean; saved?: boolean; logged: boolean; compact?: boolean
  /** En el permalink el hilo ya está debajo: el botón lleva hasta él en vez de
   *  abrir una segunda caja de comentarios. */
  commentsAnchor?: string
  /** Quién firma la publicación y quién eres tú: define si puedes retirarla. */
  authorHandle?: string
  me?: string | null
}

function ago(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'ahora'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`
  const h = Math.floor(s / 3600); if (h < 24) return `${h}h`
  return `${Math.floor(s / 86400)}d`
}

const PostActions: React.FC<Props> = ({ postId, likes: l0, comments: c0, liked: liked0, saved: saved0, logged, commentsAnchor, authorHandle, me = null }) => {
  const [liked, setLiked] = useState(!!liked0)
  const [likes, setLikes] = useState(l0)
  const [saved, setSaved] = useState(!!saved0)
  const [count, setCount] = useState(c0)
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<C[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [borrado, setBorrado] = useState(false)

  // Firmas como tu cuenta o como el scan activo: puedes retirar lo que lleve
  // tu firma actual.
  const [firmo, setFirmo] = useState<string | null>(null)
  useEffect(() => {
    const leer = () => setFirmo(getIdentity() || me)
    leer()
    window.addEventListener('lc:identity', leer)
    return () => window.removeEventListener('lc:identity', leer)
  }, [me])
  const esMio = !!authorHandle && !!firmo && authorHandle === firmo

  const borrarPost = async () => {
    if (!confirm('¿Eliminar esta publicación? Dejará de verse en La Charca.')) return
    setBorrado(true)
    try {
      await hilosApi.removePost(postId)
    } catch {
      setBorrado(false)
      flash('No se pudo eliminar la publicación')
    }
  }
  const [toast, setToast] = useState<string | null>(null)

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2000) }
  const needLogin = () => { window.location.href = '/auth/login' }
  const url = typeof window !== 'undefined' ? `${window.location.origin}/post/${postId}` : ''

  const toggleLike = async () => {
    if (!logged) return needLogin()
    const n = !liked
    setLiked(n); setLikes((x) => x + (n ? 1 : -1))
    try { const r = await hilosApi.like(postId); setLiked(r.liked); setLikes(r.likesCount) }
    catch { setLiked(!n); setLikes((x) => x + (n ? -1 : 1)) }
  }

  const toggleComments = async () => {
    // Si la vista ya muestra el hilo completo, no duplicamos la caja.
    if (commentsAnchor) {
      const el = document.getElementById(commentsAnchor)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const box = el.querySelector('textarea') as HTMLTextAreaElement | null
        setTimeout(() => box?.focus(), 320)
        return
      }
    }
    const next = !open
    setOpen(next)
    if (next && list === null) {
      setList(null)
      try {
        const d = await hilosApi.comments(postId)
        setList(Array.isArray(d) ? d : d?.items || [])
      } catch { setList([]) }
    }
  }

  const send = async () => {
    if (!logged) return needLogin()
    const c = text.trim(); if (!c || busy) return
    // Optimista: pintamos el comentario al instante con un id temporal.
    const tempId = -Date.now()
    const optimistic: C = { id: tempId, content: c, parentCommentId: null, createdAt: new Date().toISOString(), author: { handle: 'tu', displayName: 'Tú', avatarUrl: null } }
    setList((l) => [...(l || []), optimistic])
    setCount((n) => n + 1); setText(''); setBusy(true)
    try {
      const created = await hilosApi.comment(postId, c)
      setList((l) => (l || []).map((x) => (x.id === tempId ? created : x)))   // reconciliar
    } catch {
      setList((l) => (l || []).filter((x) => x.id !== tempId))                // revertir
      setCount((n) => Math.max(0, n - 1)); setText(c); flash('No se pudo comentar')
    } finally { setBusy(false) }
  }

  const share = async () => {
    const data = { title: 'La Charca', url }
    try {
      if (navigator.share) { await navigator.share(data); return }
      await navigator.clipboard.writeText(url); flash('Enlace copiado')
    } catch { /* cancelado */ }
  }
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); flash('Enlace copiado') } catch { flash('No se pudo copiar') }
  }
  const toggleSave = async () => {
    if (!logged) return needLogin()
    const next = !saved
    setSaved(next); flash(next ? 'Guardado' : 'Quitado de guardados')   // optimista
    try { const r = await hilosApi.save(postId); setSaved(!!r.saved) }   // reconciliar
    catch { setSaved(!next); flash('No se pudo guardar') }               // revertir
  }

  if (borrado) {
    return <p className="mt-3 t-caption">Publicación eliminada.</p>
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1">
        <button type="button" onClick={toggleComments} className={`act ${open && !commentsAnchor ? 'is-on' : ''}`}
          title={commentsAnchor ? 'Ir a los comentarios' : 'Comentarios'} aria-label="Comentarios" aria-expanded={commentsAnchor ? undefined : open}>
          <ChatCircle size={19} weight={open && !commentsAnchor ? 'fill' : 'regular'} />
          {count > 0 && <span className="tabular-nums">{count}</span>}
        </button>

        <button type="button" onClick={toggleLike} className={`act ${liked ? 'is-on' : ''}`} title="Me gusta" aria-label="Me gusta" aria-pressed={liked}>
          <Heart size={19} weight={liked ? 'fill' : 'regular'} />
          {likes > 0 && <span className="tabular-nums">{likes}</span>}
        </button>

        <button type="button" onClick={toggleSave} className={`act ${saved ? 'is-on' : ''}`} title="Guardar" aria-label="Guardar" aria-pressed={saved}>
          <BookmarkSimple size={19} weight={saved ? 'fill' : 'regular'} />
        </button>

        <button type="button" onClick={share} className="act" title="Compartir" aria-label="Compartir">
          <ShareNetwork size={19} />
        </button>

        <button type="button" onClick={copyLink} className="act" title="Copiar enlace" aria-label="Copiar enlace">
          <LinkSimple size={19} />
        </button>
      </div>

      {open && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
          {logged && (
            <div className="flex items-end gap-2 mb-4">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send() }}
                placeholder="Súmate a la conversación"
                className="flex-1 resize-none rounded-xl px-3.5 py-2.5 text-[15px] focus:outline-none"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }} />
              <button type="button" onClick={send} disabled={busy || !text.trim()} className="btn disabled:opacity-35">
                {busy ? '···' : 'Enviar'}
              </button>
            </div>
          )}
          {list === null ? (
            <div className="space-y-4" aria-hidden>
              {[0, 1].map((i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="skeleton rounded-full shrink-0" style={{ width: 32, height: 32 }} />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 rounded" style={{ width: '26%' }} />
                    <div className="skeleton h-3.5 rounded" style={{ width: i ? '62%' : '86%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            <p className="t-sub py-4 text-center">Sin comentarios todavía.</p>
          ) : (
            <div className="space-y-4">
              {list.map((c) => (
                <div key={c.id} className="flex items-start gap-2.5 rise" style={c.id < 0 ? { opacity: .55 } : undefined}>
                  <a href={`/@${c.author?.handle}`} data-hover-handle={c.author?.handle} className="shrink-0">
                    {c.author?.avatarUrl
                      ? <img src={c.author.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      : <span className="grid place-items-center w-8 h-8 rounded-full text-[12px] font-semibold" style={{ background: 'var(--soft)', color: 'var(--blue)' }}>{(c.author?.displayName || c.author?.handle || '?')[0]?.toUpperCase()}</span>}
                  </a>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px]">
                      <a href={`/@${c.author?.handle}`} className="font-semibold hover:opacity-70">{c.author?.displayName || c.author?.handle}</a>
                      <span className="ink-3"> · {ago(c.createdAt)}</span>
                    </p>
                    <p className="text-[15px] whitespace-pre-wrap break-words">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {toast && <div className="toast"><Check size={16} weight="bold" style={{ display: 'inline', marginRight: 6, verticalAlign: -3 }} />{toast}</div>}
    </div>
  )
}
export default PostActions
