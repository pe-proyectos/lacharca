import React, { useState } from 'react'
import { hilosApi } from '../lib/hilosClient'

interface C { id: number; content: string; parentCommentId: number | null; createdAt: string; author: { handle: string; displayName?: string | null; avatarUrl?: string | null } }
interface Props { postId: number; initial: C[]; logged: boolean }

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
    : <div style={{ width: size, height: size }} className="rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/70 shrink-0">{(c?.displayName || c?.handle || '?')[0]?.toUpperCase()}</div>
)

const CommentThread: React.FC<Props> = ({ postId, initial, logged }) => {
  const [items, setItems] = useState<C[]>(initial || [])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const [replyText, setReplyText] = useState('')

  const byParent = new Map<number, C[]>()
  for (const c of items) { const k = c.parentCommentId || 0; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k)!.push(c) }
  const roots = byParent.get(0) || []

  const needLogin = () => { window.location.href = '/auth/login' }

  const send = async (parentId?: number) => {
    if (!logged) return needLogin()
    const content = (parentId ? replyText : text).trim()
    if (!content || busy) return
    setBusy(true)
    try {
      const c = await hilosApi.comment(postId, content, parentId)
      setItems((l) => [...l, c])
      if (parentId) { setReplyText(''); setReplyTo(null) } else setText('')
    } catch { /* noop */ } finally { setBusy(false) }
  }

  const Item = ({ c, nested = false }: { c: C; nested?: boolean }) => {
    const { text: body, imgs } = splitMedia(c.content)
    const replies = byParent.get(c.id) || []
    return (
      <div className={nested ? '' : 'py-3 border-b border-white/[0.04]'}>
        <div className="flex items-start gap-2.5">
          <a href={`/@${c.author?.handle}`}><Avatar c={c.author} size={nested ? 30 : 36} /></a>
          <div className="min-w-0 flex-1">
            <p className="text-[13px]">
              <a href={`/@${c.author?.handle}`} className="font-bold text-white hover:underline">{c.author?.displayName || c.author?.handle}</a>
              <span className="text-white/35"> · {ago(c.createdAt)}</span>
            </p>
            {body && <p className="text-[14px] text-white/85 whitespace-pre-wrap break-words mt-0.5">{body}</p>}
            {imgs.map((u, i) => <img key={i} src={u} alt="" loading="lazy" className="mt-2 rounded-xl max-h-80 ring-1 ring-white/10" />)}
            {!nested && (
              <button type="button" onClick={() => { if (!logged) return needLogin(); setReplyTo(replyTo === c.id ? null : c.id); setReplyText('') }}
                className="mt-1 text-[12px] font-bold text-white/40 hover:text-teal-300 cursor-pointer">Responder</button>
            )}
            {replyTo === c.id && (
              <div className="mt-2 flex items-end gap-2">
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={1} autoFocus
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send(c.id) }}
                  placeholder={`Responder a ${c.author?.displayName || c.author?.handle}`}
                  className="flex-1 resize-none rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-400/40" />
                <button type="button" onClick={() => send(c.id)} disabled={busy || !replyText.trim()}
                  className="px-3 py-2 rounded-xl bg-teal-500 text-zinc-950 text-sm font-black disabled:opacity-40 cursor-pointer">→</button>
              </div>
            )}
            {replies.length > 0 && (
              <div className="mt-3 pl-3 border-l-2 border-white/10 space-y-3">
                {replies.map((r) => <Item key={r.id} c={r} nested />)}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-sm font-black text-white/50 uppercase tracking-wider py-2">{items.length} comentarios</h2>
      {logged ? (
        <div className="flex items-end gap-2 mb-4">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send() }}
            placeholder="Súmate a la conversación"
            className="flex-1 resize-none rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-400/40" />
          <button type="button" onClick={() => send()} disabled={busy || !text.trim()}
            className="px-4 py-2 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 text-zinc-950 text-sm font-black disabled:opacity-40 cursor-pointer">Enviar</button>
        </div>
      ) : (
        <a href="/auth/login" className="block text-center text-teal-400 font-bold text-sm py-3 hover:underline">Únete a la charca para comentar</a>
      )}
      {roots.length === 0 ? <p className="text-white/40 text-sm py-6 text-center">Sin comentarios.</p> : roots.map((c) => <Item key={c.id} c={c} />)}
    </div>
  )
}
export default CommentThread
