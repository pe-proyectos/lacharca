import React, { useCallback, useEffect, useRef, useState } from 'react'
import PostCard, { type PostShape } from './PostCard'

interface Props { scope: string; logged: boolean; startPage?: number; pageSize?: number; sort?: string }

// Continuación paginada del feed servido por SSR. Carga 25 posts por tanda con
// scroll infinito, para no pedirle a la base de datos más de lo necesario.
const FeedMore: React.FC<Props> = ({ scope, logged, startPage = 1, pageSize = 25, sort }) => {
  const [items, setItems] = useState<PostShape[]>([])
  const [page, setPage] = useState(startPage)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)

  const load = useCallback(async (p: number) => {
    setLoading(true); setFailed(false)
    try {
      const res = await fetch(`/api/feed?scope=${encodeURIComponent(scope)}&page=${p}&limit=${pageSize}&replies=1${sort ? `&sort=${encodeURIComponent(sort)}` : ''}`, { credentials: 'include' })
      const json: any = await res.json().catch(() => ({}))
      const d = json?.data
      if (!d) throw new Error('bad_response')
      setItems((prev) => [...prev, ...(d.items || [])])
      setHasMore(!!d.hasMore)
    } catch { setFailed(true) } finally { setLoading(false) }
  }, [scope, pageSize, sort])

  useEffect(() => {
    if (!hasMore || loading || failed) return
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting) { setPage((p) => { load(p); return p + 1 }) }
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
      {!hasMore && items.length > 0 && <p className="t-caption text-center py-10">Llegaste al fondo de la charca.</p>}
    </>
  )
}
export default FeedMore
