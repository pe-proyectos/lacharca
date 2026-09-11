import React, { useState } from 'react'
import { hilosApi } from '../lib/hilosClient'

interface C { id: number; content: string; createdAt: string; author: { handle: string; displayName?: string | null; avatarUrl?: string | null } }
interface Props { postId: number; likes: number; comments: number; liked?: boolean; logged: boolean }

const PostActions: React.FC<Props> = ({ postId, likes: likes0, comments: comments0, liked: liked0, logged }) => {
  const [likes, setLikes] = useState(likes0)
  const [liked, setLiked] = useState(!!liked0)
  const [count, setCount] = useState(comments0)
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<C[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const needLogin = () => { window.location.href = '/auth/login' }

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
    if (next && list === null) {
      try { setList(await hilosApi.comments(postId)) } catch { setList([]) }
    }
  }

  const send = async () => {
    if (!logged) return needLogin()
    const c = text.trim()
    if (!c || busy) return
    setBusy(true)
    try {
      const created = await hilosApi.comment(postId, c)
      setList((l) => [...(l || []), created]); setCount((n) => n + 1); setText('')
    } catch { /* noop */ } finally { setBusy(false) }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-7">
        <button type="button" onClick={toggleComments} className="flex items-center gap-2 cursor-pointer transition text-[14px] hover:opacity-70" style={{ color: open ? "var(--aqua)" : "var(--ink-3)" }}>
          <span>💬</span> <span className="tabular-nums">{count || ''}</span>
        </button>
        <button type="button" onClick={toggleLike} className="flex items-center gap-2 cursor-pointer transition text-[14px] hover:opacity-70" style={{ color: liked ? "var(--sun)" : "var(--ink-3)" }}>
          <span>{liked ? '❤' : '♡'}</span> <span className="tabular-nums">{likes || ''}</span>
        </button>
      </div>

      {open && (
        <div className="mt-3 border-t border-white/[0.06] pt-3">
          {logged && (
            <div className="flex items-end gap-2 mb-3">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send() }}
                placeholder="Súmate a la conversación"
                className="flex-1 resize-none rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-400/40" />
              <button type="button" onClick={send} disabled={busy || !text.trim()}
                className="px-3 py-2 rounded-xl bg-teal-500 text-zinc-950 text-sm font-black disabled:opacity-40 cursor-pointer">→</button>
            </div>
          )}
          {list === null ? <p className="text-xs text-white/35 py-2">Cargando…</p>
            : list.length === 0 ? <p className="text-xs text-white/35 py-2">Sin comentarios todavía.</p>
            : <div className="space-y-2.5">
                {list.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    {c.author?.avatarUrl
                      ? <img src={c.author.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                      : <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-bold text-white/70">{(c.author?.displayName || c.author?.handle || '?')[0]?.toUpperCase()}</div>}
                    <div className="rounded-2xl bg-white/[0.04] px-3 py-2 flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-white/90">{c.author?.displayName || c.author?.handle}</p>
                      <p className="text-[13px] text-white/80 whitespace-pre-wrap break-words">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>}
        </div>
      )}
    </div>
  )
}
export default PostActions
