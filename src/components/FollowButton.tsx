import React, { useState } from 'react'
import { hilosApi } from '../lib/hilosClient'

interface Props { handle: string; initialFollowing?: boolean; logged: boolean; followers?: number; compact?: boolean; onChange?: (following: boolean) => void }

const FollowButton: React.FC<Props> = ({ handle, initialFollowing, logged, followers: f0 = 0, compact = false, onChange }) => {
  const [following, setFollowing] = useState(!!initialFollowing)
  const [followers, setFollowers] = useState(f0)
  const [busy, setBusy] = useState(false)

  // Avisamos al resto de la interfaz (p. ej. el botón de mensaje) del cambio.
  const announce = (v: boolean) => {
    onChange?.(v)
    window.dispatchEvent(new CustomEvent('lc:follow', { detail: { handle, following: v } }))
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
              ? { borderColor: 'var(--line)', color: 'var(--ink-2)', background: '#fff' }
              : { borderColor: 'var(--blue)', background: 'var(--blue)', color: '#fff' })
          : (following ? { borderColor: 'var(--line)', color: 'var(--ink-2)', background: '#fff' } : undefined)
      }>
      {following ? 'Siguiendo' : 'Seguir'}
    </button>
  )
}
export default FollowButton
