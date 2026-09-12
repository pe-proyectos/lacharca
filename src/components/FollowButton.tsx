import React, { useEffect, useState } from 'react'
import { hilosApi } from '../lib/hilosClient'

interface Props { handle: string; initialFollowing?: boolean; logged: boolean; followers?: number; compact?: boolean; onChange?: (following: boolean) => void }

const FollowButton: React.FC<Props> = ({ handle, initialFollowing, logged, followers: f0 = 0, compact = false, onChange }) => {
  const id = React.useRef(Math.random().toString(36).slice(2))
  const [following, setFollowing] = useState(!!initialFollowing)
  const [followers, setFollowers] = useState(f0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const sync = (e: any) => {
      if (e?.detail?.handle !== handle || e.detail.from === id.current) return
      setFollowing((cur) => {
        const next = !!e.detail.following
        if (cur !== next) setFollowers((n) => Math.max(0, n + (next ? 1 : -1)))
        return next
      })
    }
    window.addEventListener('lc:follow', sync)
    return () => window.removeEventListener('lc:follow', sync)
  }, [handle])

  // Avisamos al resto de la interfaz (p. ej. el botón de mensaje) del cambio.
  const announce = (v: boolean) => {
    onChange?.(v)
    window.dispatchEvent(new CustomEvent('lc:follow', { detail: { handle, following: v, from: id.current } }))
    // Los contadores escritos por el servidor también se ponen al día.
    document.querySelectorAll(`[data-followers="${handle}"]`).forEach((el) => {
      const base = Number((el as HTMLElement).dataset.count || 0)
      const n = Math.max(0, base + (v ? 1 : 0))
      el.textContent = n.toLocaleString('es')
      const word = el.nextElementSibling
      if (word) word.textContent = n === 1 ? 'seguidor' : 'seguidores'
    })
  }

  const toggle = async () => {
    if (!logged) { window.location.href = '/auth/login'; return }
    if (busy) return
    const next = !following
    setFollowing(next); setFollowers((n) => n + (next ? 1 : -1)); setBusy(true); announce(next)
    try { const r = await hilosApi.follow(handle); setFollowing(!!r.following); announce(!!r.following) }
    catch { setFollowing(!next); setFollowers((n) => n + (next ? -1 : 1)); announce(!next) }
    finally { setBusy(false) }
  }

  return (
    <button type="button" onClick={toggle} disabled={busy}
      aria-pressed={following}
      className={
        compact
          ? `shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium cursor-pointer transition border ${following ? '' : 'hover:opacity-85'}`
          : following
            ? 'inline-flex items-center px-5 py-2.5 rounded-xl text-[15px] font-semibold cursor-pointer transition border'
            : 'btn cursor-pointer'
      }
      style={
        compact
          ? (following
              ? { borderColor: 'var(--line)', color: 'var(--ink-2)', background: 'var(--surface)' }
              : { borderColor: 'var(--blue)', background: 'var(--blue)', color: '#fff' })
          : (following ? { borderColor: 'var(--line)', color: 'var(--ink-2)', background: 'var(--surface)' } : undefined)
      }>
      {busy ? '…' : following ? 'Siguiendo' : 'Seguir'}
    </button>
  )
}
export default FollowButton
