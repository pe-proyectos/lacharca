import React, { useState } from 'react'
import { hilosApi } from '../lib/hilosClient'
import { GlassButton } from './Glass'

interface Props { user: { handle: string; displayName?: string | null; avatarUrl?: string | null } }

const Composer: React.FC<Props> = ({ user }) => {
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const over = content.length > 5000

  const submit = async () => {
    const text = content.trim()
    if (!text || busy || over) return
    setBusy(true); setErr(null)
    try {
      await hilosApi.createPost(text)
      setContent('')
      window.location.reload() // el feed es SSR; recargamos para verlo
    } catch (e: any) {
      setErr(e?.message === 'rate_limited' ? 'Vas muy rápido, espera un momento.' : 'No se pudo publicar.')
      setBusy(false)
    }
  }

  return (
    <div className="flex gap-3 px-4 py-3 border-b border-white/[0.06]">
      {user.avatarUrl
        ? <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
        : <div className="w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-medium shrink-0" style={{ background: "rgba(95,227,220,.16)", color: "var(--aqua)" }}>{(user.displayName || user.handle)[0]?.toUpperCase()}</div>}
      <div className="flex-1 min-w-0">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit() }}
          rows={2}
          placeholder="¿Qué cuentas hoy?"
          className="w-full resize-none bg-transparent text-[19px] font-light tracking-[-0.02em] text-white placeholder-white/30 focus:outline-none"
        />
        {err && <p className="text-[12px] text-rose-300 mb-1">{err}</p>}
        <div className="flex items-center justify-end gap-3">
          {content.length > 4500 && <span className={`text-[11px] font-bold tabular-nums ${over ? 'text-rose-400' : 'text-white/40'}`}>{5000 - content.length}</span>}
          {busy || over || !content.trim()
            ? <span className="px-6 py-3 rounded-full text-[15px] opacity-35 select-none" style={{ background: 'rgba(255,255,255,.07)' }}>Publicar</span>
            : <GlassButton onClick={submit} tint>Publicar</GlassButton>}
        </div>
      </div>
    </div>
  )
}
export default Composer
