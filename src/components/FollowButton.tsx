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
      className={`px-4 py-1.5 rounded-full text-sm font-black transition cursor-pointer disabled:opacity-50 ${
        following ? 'bg-white/10 text-white hover:bg-rose-500/20 hover:text-rose-300' : 'bg-gradient-to-br from-teal-400 to-cyan-500 text-zinc-950 hover:from-teal-300'
      }`}>
      {following ? 'Siguiendo' : 'Seguir'}
    </button>
  )
}
export default FollowButton
