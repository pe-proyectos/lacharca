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
    : <div style={{ width: size, height: size }} className="rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: "#dbe8fb", color: "var(--blue)" }}>{(c?.displayName || c?.handle || '?')[0]?.toUpperCase()}</div>
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
              <a href={`/@${c.author?.handle}`} className="font-semibold hover:opacity-70">{c.author?.displayName || c.author?.handle}</a>
              <span className="ink-3"> · {ago(c.createdAt)}</span>
            </p>
            {body && <p className="t-body whitespace-pre-wrap break-words mt-0.5">{body}</p>}
            {imgs.map((u, i) => <img key={i} src={u} alt="" loading="lazy" className="mt-2 rounded-xl max-h-80 ring-1 ring-white/10" />)}
            {!nested && (
              <button type="button" onClick={() => { if (!logged) return needLogin(); setReplyTo(replyTo === c.id ? null : c.id); setReplyText('') }}
                className="mt-1.5 text-[13px] font-semibold cursor-pointer hover:opacity-70" style={{ color: "var(--blue)" }}>Responder</button>
            )}
            {replyTo === c.id && (
              <div className="mt-2 flex items-end gap-2">
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={1} autoFocus
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send(c.id) }}
                  placeholder={`Responder a ${c.author?.displayName || c.author?.handle}`}
                  className="flex-1 resize-none rounded-xl px-3.5 py-2.5 text-[15px] focus:outline-none" style={{ background: "#f5f8fd", border: "1px solid var(--line)" }} />
                <button type="button" onClick={() => send(c.id)} disabled={busy || !replyText.trim()}
                  className="btn disabled:opacity-35 cursor-pointer">→</button>
              </div>
            )}
            {replies.length > 0 && (
              <div className="mt-4 pl-4 border-l-2 space-y-4" style={{ borderColor: "var(--line)" }}>
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
      <h2 className="eyebrow py-3">{items.length} comentarios</h2>
      {logged ? (
        <div className="flex items-end gap-2 mb-4">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send() }}
            placeholder="Súmate a la conversación"
            className="flex-1 resize-none rounded-xl px-3.5 py-2.5 text-[15px] focus:outline-none" style={{ background: "#f5f8fd", border: "1px solid var(--line)" }} />
          <button type="button" onClick={() => send()} disabled={busy || !text.trim()}
            className="btn disabled:opacity-35 cursor-pointer">Enviar</button>
        </div>
      ) : (
        <a href="/auth/login" className="btn-ghost w-full justify-center my-2">Únete a la charca para comentar</a>
      )}
      {roots.length === 0 ? <p className="t-sub py-8 text-center">Sin comentarios.</p> : roots.map((c) => <Item key={c.id} c={c} />)}
    </div>
  )
}
export default CommentThread
