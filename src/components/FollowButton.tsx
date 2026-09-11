import React, { useState } from 'react'
import { hilosApi } from '../lib/hilosClient'
import { GlassButton } from './Glass'

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

  return <GlassButton onClick={toggle} size="sm" tint={!following}>{following ? 'Siguiendo' : 'Seguir'}</GlassButton>
}
export default FollowButton
