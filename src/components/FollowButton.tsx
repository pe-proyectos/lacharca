import React, { useState } from 'react'
import { hilosApi } from '../lib/hilosClient'

interface Props { handle: string; initialFollowing?: boolean; logged: boolean; followers?: number }

const FollowButton: React.FC<Props> = ({ handle, initialFollowing, logged, followers: f0 = 0 }) => {
  const [following, setFollowing] = useState(!!initialFollowing)
  const [followers, setFollowers] = useState(f0)
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    if (!logged) { window.location.href = '/auth/login'; return }
    if (busy) return
    const next = !following
    setFollowing(next); setFollowers((n) => n + (next ? 1 : -1)); setBusy(true)
    try { const r = await hilosApi.follow(handle); setFollowing(!!r.following) }
    catch { setFollowing(!next); setFollowers((n) => n + (next ? -1 : 1)) }
    finally { setBusy(false) }
  }

  return (
    <button type="button" onClick={toggle} disabled={busy}
      className={following
        ? 'inline-flex items-center px-5 py-2.5 rounded-xl text-[15px] font-semibold cursor-pointer transition border'
        : 'btn cursor-pointer'}
      style={following ? { borderColor: 'var(--line)', color: 'var(--ink-2)', background: '#fff' } : undefined}>
      {following ? 'Siguiendo' : 'Seguir'}
    </button>
  )
}
export default FollowButton
