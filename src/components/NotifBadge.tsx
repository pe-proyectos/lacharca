import React, { useEffect, useState } from 'react'
import { hilosApi } from '../lib/hilosClient'

// Contador de avisos sin leer junto a la entrada de navegación.
const NotifBadge: React.FC = () => {
  const [n, setN] = useState(0)

  useEffect(() => {
    let alive = true
    const tick = () => hilosApi.notificationsUnread()
      .then((d: any) => { if (alive) setN(d?.total || 0) })
      .catch(() => {})
    tick()
    const id = setInterval(tick, 60000)
    const clear = () => setN(0)
    window.addEventListener('lc:notifs-read', clear)
    return () => { alive = false; clearInterval(id); window.removeEventListener('lc:notifs-read', clear) }
  }, [])

  if (!n) return null
  return (
    <span className="grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold tabular-nums"
      style={{ background: 'var(--blue)', color: '#fff' }}>{n > 99 ? '99+' : n}</span>
  )
}
export default NotifBadge
