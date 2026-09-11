import React, { useState } from 'react'
import { ChatCircle, Heart, BookmarkSimple, ShareNetwork, LinkSimple, Check } from '@phosphor-icons/react'
import { hilosApi } from '../lib/hilosClient'

interface C { id: number; content: string; parentCommentId: number | null; createdAt: string; author: { handle: string; displayName?: string | null; avatarUrl?: string | null } }
interface Props { postId: number; likes: number; comments: number; liked?: boolean; saved?: boolean; logged: boolean; compact?: boolean }

function ago(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'ahora'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`
  const h = Math.floor(s / 3600); if (h < 24) return `${h}h`
  return `${Math.floor(s / 86400)}d`
}

const PostActions: React.FC<Props> = ({ postId, likes: l0, comments: c0, liked: liked0, saved: saved0, logged }) => {
  const [liked, setLiked] = useState(!!liked0)
  const [likes, setLikes] = useState(l0)
  const [saved, setSaved] = useState(!!saved0)
  const [count, setCount] = useState(c0)
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<C[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
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
    const next = !open
    setOpen(next)
    if (next && list === null) { try { setList(await hilosApi.comments(postId)) } catch { setList([]) } }
  }

  const send = async () => {
    if (!logged) return needLogin()
    const c = text.trim(); if (!c || busy) return
    setBusy(true)
    try { const created = await hilosApi.comment(postId, c); setList((l) => [...(l || []), created]); setCount((n) => n + 1); setText('') }
    catch { flash('No se pudo comentar') } finally { setBusy(false) }
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
  const toggleSave = () => {
    if (!logged) return needLogin()
    setSaved((s) => !s); flash(saved ? 'Quitado de guardados' : 'Guardado')
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1">
        <button type="button" onClick={toggleComments} className={`act ${open ? 'is-on' : ''}`} title="Comentarios" aria-label="Comentarios">
          <ChatCircle size={19} weight={open ? 'fill' : 'regular'} />
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
                style={{ background: '#f5f8fd', border: '1px solid var(--line)' }} />
              <button type="button" onClick={send} disabled={busy || !text.trim()} className="btn disabled:opacity-35">
                {busy ? '···' : 'Enviar'}
              </button>
            </div>
          )}
          {list === null ? (
            <div className="space-y-3">{[0,1].map((i) => <div key={i} className="skeleton h-12" />)}</div>
          ) : list.length === 0 ? (
            <p className="t-sub py-4 text-center">Sin comentarios todavía.</p>
          ) : (
            <div className="space-y-4">
              {list.map((c) => (
                <div key={c.id} className="flex items-start gap-2.5 rise">
                  <a href={`/@${c.author?.handle}`} className="shrink-0">
                    {c.author?.avatarUrl
                      ? <img src={c.author.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      : <span className="grid place-items-center w-8 h-8 rounded-full text-[12px] font-semibold" style={{ background: '#dbe8fb', color: 'var(--blue)' }}>{(c.author?.displayName || c.author?.handle || '?')[0]?.toUpperCase()}</span>}
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
