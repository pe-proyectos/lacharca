import React, { useCallback, useEffect, useRef, useState } from 'react'
import PostCard, { type PostShape } from './PostCard'

interface Props { handle: string; logged: boolean; startPage?: number; pageSize?: number }

// Continuación paginada del muro de un perfil. Un scan puede tener miles de
// publicaciones: se cargan por tandas conforme se baja.
const ProfileMore: React.FC<Props> = ({ handle, logged, startPage = 1, pageSize = 25 }) => {
  const [items, setItems] = useState<PostShape[]>([])
  const [page, setPage] = useState(startPage)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)

  const load = useCallback(async (p: number) => {
    setLoading(true); setFailed(false)
    try {
      const res = await fetch(`/api/pages/${encodeURIComponent(handle)}/posts?page=${p}&limit=${pageSize}`, { credentials: 'include' })
      const json: any = await res.json().catch(() => ({}))
      if (!json?.data) throw new Error('bad_response')
      setItems((prev) => [...prev, ...(json.data.items || [])])
      setHasMore(!!json.data.hasMore)
    } catch { setFailed(true) } finally { setLoading(false) }
  }, [handle, pageSize])

  useEffect(() => {
    if (!hasMore || loading || failed) return
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting) setPage((p) => { load(p); return p + 1 })
    }, { rootMargin: '900px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading, failed, load])

  return (
    <>
      {items.map((p) => <PostCard key={p.id} post={p} logged={logged} />)}

      {loading && (
        <div aria-hidden className="py-6 space-y-6">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3.5">
              <div className="skeleton rounded-full shrink-0" style={{ width: 44, height: 44 }} />
              <div className="flex-1 max-w-[760px] space-y-2.5">
                <div className="skeleton h-3.5 rounded" style={{ width: '38%' }} />
                <div className="skeleton h-3.5 rounded" style={{ width: '92%' }} />
                <div className="skeleton h-3.5 rounded" style={{ width: '64%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {failed && (
        <div className="py-8 text-center">
          <p className="t-sub mb-3">No pudimos cargar más publicaciones.</p>
          <button type="button" onClick={() => load(page)} className="chip cursor-pointer">Reintentar</button>
        </div>
      )}

      {hasMore && !failed && <div ref={sentinel} className="h-4" />}
      {!hasMore && items.length > 0 && <p className="t-caption text-center py-10">No hay más publicaciones.</p>}
    </>
  )
}
export default ProfileMore
