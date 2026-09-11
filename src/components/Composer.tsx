import React, { useState } from 'react'
import { hilosApi } from '../lib/hilosClient'

interface Props {
  user: { handle: string; displayName?: string | null; avatarUrl?: string | null }
  onOptimistic?: (tempId: number, content: string) => void
  onPosted?: (tempId: number, post: any) => void
  onFailed?: (tempId: number) => void
}

const LIMIT = 5000

const Composer: React.FC<Props> = ({ user, onOptimistic, onPosted, onFailed }) => {
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const left = LIMIT - content.length
  const over = left < 0

  const submit = async () => {
    const text = content.trim()
    if (!text || busy || over) return
    setErr(null)
    // Optimista: el post aparece ya; el padre lo reconcilia cuando responde el API.
    const tempId = -Date.now()
    if (onOptimistic) { onOptimistic(tempId, text); setContent('') } else setBusy(true)
    try {
      const post = await hilosApi.createPost(text)
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
          rows={2}
          placeholder="¿Qué cuentas hoy?"
          aria-label="Escribe una publicación"
          className="w-full resize-none bg-transparent text-[19px] tracking-[-0.02em] placeholder-[color:var(--ink-3)] focus:outline-none"
        />
        {err && <p className="t-caption mb-2" style={{ color: '#b42318' }}>{err}</p>}
        <div className="flex items-center justify-end gap-3">
          {content.length > LIMIT - 500 && (
            <span className="text-[12px] tabular-nums" style={{ color: over ? '#b42318' : 'var(--ink-3)' }}>{left}</span>
          )}
          <button type="button" onClick={submit} disabled={busy || over || !content.trim()}
            className="btn disabled:opacity-35 disabled:cursor-default cursor-pointer">
            {busy ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  )
}
export default Composer
