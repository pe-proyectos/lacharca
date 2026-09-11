import React, { useEffect, useRef, useState } from 'react'
import FollowButton from './FollowButton'
import MessageButton from './MessageButton'

interface Page {
  handle: string; type?: string; displayName?: string | null; avatarUrl?: string | null
  bio?: string | null; followersCount?: number; followingCount?: number; postsCount?: number
  viewerFollows?: boolean
}

// Cache entre montajes: pasar el raton por el mismo perfil no repite la llamada.
const cache = new Map<string, Page | null>()
const n = (v: any) => Number(v || 0).toLocaleString('es')

// Tarjeta flotante al pasar el cursor sobre una mención o un enlace de perfil.
// Se activa sobre cualquier ancla con data-hover-handle dentro de la página.
const UserHoverCard: React.FC<{ me?: string | null }> = ({ me = null }) => {
  const [page, setPage] = useState<Page | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(null)
  const [loading, setLoading] = useState(false)
  const timer = useRef<any>(null)
  const hideTimer = useRef<any>(null)
  const current = useRef<string | null>(null)

  useEffect(() => {
    if (window.matchMedia('(hover: none)').matches) return // en táctil no aplica

    const show = async (el: HTMLElement) => {
      const handle = el.dataset.hoverHandle!
      current.current = handle
      const r = el.getBoundingClientRect()
      const above = r.top > 320
      setPos({ x: Math.min(Math.max(r.left, 12), window.innerWidth - 312), y: above ? r.top - 8 : r.bottom + 8, above })

      if (cache.has(handle)) { setPage(cache.get(handle)!); return }
      setLoading(true); setPage(null)
      try {
        const res = await fetch(`/api/pages/${encodeURIComponent(handle)}`)
        const json: any = await res.json().catch(() => ({}))
        const p = json?.status ? json.data : null
        cache.set(handle, p)
        if (current.current === handle) setPage(p)
      } catch { cache.set(handle, null) } finally { setLoading(false) }
    }

    const onOver = (e: Event) => {
      const el = (e.target as HTMLElement)?.closest?.('[data-hover-handle]') as HTMLElement | null
      if (!el) return
      clearTimeout(hideTimer.current); clearTimeout(timer.current)
      timer.current = setTimeout(() => show(el), 380) // sin parpadeos al pasar de largo
    }
    const onOut = (e: Event) => {
      const el = (e.target as HTMLElement)?.closest?.('[data-hover-handle]')
      if (!el) return
      clearTimeout(timer.current)
      hideTimer.current = setTimeout(() => { current.current = null; setPos(null); setPage(null) }, 220)
    }

    document.addEventListener('mouseover', onOver, true)
    document.addEventListener('mouseout', onOut, true)
    return () => {
      document.removeEventListener('mouseover', onOver, true)
      document.removeEventListener('mouseout', onOut, true)
      clearTimeout(timer.current); clearTimeout(hideTimer.current)
    }
  }, [])

  if (!pos) return null

  return (
    <div
      onMouseEnter={() => clearTimeout(hideTimer.current)}
      onMouseLeave={() => { setPos(null); setPage(null) }}
      className="fixed z-50 rounded-2xl p-4 rise"
      style={{
        left: pos.x, top: pos.y, transform: pos.above ? 'translateY(-100%)' : undefined,
        width: 'min(300px, calc(100vw - 24px))',
        background: '#fff', border: '1px solid var(--line)', boxShadow: '0 12px 36px rgba(16,31,56,.14)',
      }}>
      {loading || !page ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="skeleton rounded-full" style={{ width: 48, height: 48 }} />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3.5 w-2/3 rounded" />
              <div className="skeleton h-3 w-1/3 rounded" />
            </div>
          </div>
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-4/5 rounded" />
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <a href={`/@${page.handle}`} className="shrink-0">
              {page.avatarUrl
                ? <img src={page.avatarUrl} alt="" style={{ width: 48, height: 48 }} className={`object-cover ${page.type === 'user' ? 'rounded-full' : 'rounded-xl'}`} />
                : <span style={{ width: 48, height: 48, background: '#dbe8fb', color: 'var(--blue)' }}
                    className={`grid place-items-center text-lg font-semibold ${page.type === 'user' ? 'rounded-full' : 'rounded-xl'}`}>
                    {(page.displayName || page.handle)[0]?.toUpperCase()}
                  </span>}
            </a>
            <div className="min-w-0">
              <a href={`/@${page.handle}`} className="block text-[15px] font-semibold truncate hover:opacity-70">{page.displayName || page.handle}</a>
              <span className="block t-caption truncate">@{page.handle}</span>
              {page.type === 'scan' && <span className="chip is-static mt-1.5">Scan</span>}
              {page.type === 'manga' && <span className="chip is-static mt-1.5">Obra</span>}
            </div>
          </div>

          {page.bio && <p className="t-sub mt-3 line-clamp-3" style={{ color: 'var(--ink-2)' }}>{page.bio}</p>}

          <div className="flex items-center gap-4 mt-3 text-[13px]">
            <a href={`/@${page.handle}/seguidores`} className="hover:opacity-70">
              <b className="font-semibold tabular-nums">{n(page.followersCount)}</b> <span className="ink-2">seguidores</span>
            </a>
            <a href={`/@${page.handle}/siguiendo`} className="hover:opacity-70">
              <b className="font-semibold tabular-nums">{n(page.followingCount)}</b> <span className="ink-2">siguiendo</span>
            </a>
          </div>
          <p className="t-caption mt-1">{n(page.postsCount)} {Number(page.postsCount || 0) === 1 ? 'publicación' : 'publicaciones'}</p>

          {/* Poder actuar desde aquí: es el gesto natural tras mirar un perfil. */}
          {page.handle !== me && (
            <div className="flex items-center gap-2 mt-3.5">
              <FollowButton handle={page.handle} initialFollowing={page.viewerFollows} logged={!!me}
                followers={page.followersCount || 0} compact />
              {me && page.type === 'user' && (
                <MessageButton handle={page.handle} canMessage={!!page.viewerFollows} compact />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
export default UserHoverCard
