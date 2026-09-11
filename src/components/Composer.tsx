import React, { useState } from 'react'
import { hilosApi } from '../lib/hilosClient'

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
        : <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center font-bold text-teal-200 shrink-0">{(user.displayName || user.handle)[0]?.toUpperCase()}</div>}
      <div className="flex-1 min-w-0">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit() }}
          rows={2}
          placeholder="¿Qué cuentas hoy?"
          className="w-full resize-none bg-transparent text-[16px] text-white placeholder-white/35 focus:outline-none"
        />
        {err && <p className="text-[12px] text-rose-300 mb-1">{err}</p>}
        <div className="flex items-center justify-end gap-3">
          {content.length > 4500 && <span className={`text-[11px] font-bold tabular-nums ${over ? 'text-rose-400' : 'text-white/40'}`}>{5000 - content.length}</span>}
          <button type="button" onClick={submit} disabled={busy || over || !content.trim()}
            className="px-5 py-2 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-zinc-950 text-sm font-black hover:from-teal-300 hover:to-cyan-400 disabled:opacity-40 transition cursor-pointer">
            {busy ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  )
}
export default Composer
