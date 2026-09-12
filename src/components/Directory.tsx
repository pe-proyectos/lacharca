import React, { useCallback, useEffect, useRef, useState } from 'react'
import { MagnifyingGlass, Users, BookOpen } from '@phosphor-icons/react'
import FollowButton from './FollowButton'

interface P { id: number; handle: string; type: string; displayName?: string | null; avatarUrl?: string | null; postsCount: number; followersCount: number; viewerFollows?: boolean }
interface Props { logged: boolean; initialType?: 'scan' | 'user' | ''; showTabs?: boolean }

const Directory: React.FC<Props> = ({ logged, initialType = '', showTabs = true }) => {
  const [type, setType] = useState<'scan' | 'user' | ''>(initialType)
  const [sort, setSort] = useState('comentado')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<P[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const sentinel = useRef<HTMLDivElement>(null)
  const reqId = useRef(0)

  const load = useCallback(async (p: number, replace: boolean) => {
    const my = ++reqId.current
    setLoading(true)
    try {
      const qs = new URLSearchParams({ page: String(p), limit: '24' })
      if (type) qs.set('type', type)
      if (query) qs.set('q', query)
      qs.set('sort', sort)
      const res = await fetch(`/api/pages/directory?${qs}`, { credentials: 'include' })
      const json: any = await res.json().catch(() => ({}))
      if (my !== reqId.current) return
      const d = json?.data || { items: [], hasMore: false }
      setItems((prev) => (replace ? d.items : [...prev, ...d.items]))
      setHasMore(!!d.hasMore)
    } catch { if (my === reqId.current) setHasMore(false) }
    finally { if (my === reqId.current) setLoading(false) }
  }, [type, query, sort])

  useEffect(() => { setItems([]); setPage(0); setHasMore(true); load(0, true) }, [type, query, sort, load])

  useEffect(() => {
    if (!hasMore || loading) return
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting) { const n = page + 1; setPage(n); load(n, false) }
    }, { rootMargin: '700px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading, page, load])

  const submit = (e: React.FormEvent) => { e.preventDefault(); setQuery(q.trim()) }

  const Tab = ({ v, label, icon }: any) => (
    <button type="button" onClick={() => setType(v)} className={`chip ${type === v ? 'is-on' : ''}`}>
      {icon} {label}
    </button>
  )

  return (
    <div>
      <form onSubmit={submit} className="flex items-center gap-2 mb-5 px-4 py-3 rounded-2xl max-w-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
        <MagnifyingGlass size={19} className="ink-3 shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar scans o lectores" autoComplete="off"
          className="flex-1 bg-transparent text-[16px] focus:outline-none" />
        {query && <button type="button" onClick={() => { setQ(''); setQuery('') }} className="t-caption hover:opacity-70">Limpiar</button>}
      </form>

      {showTabs && (
        <div className="flex items-center gap-2 mb-4">
          <Tab v="" label="Todos" icon={null} />
          <Tab v="scan" label="Scans" icon={<BookOpen size={16} weight={type === 'scan' ? 'fill' : 'regular'} />} />
          <Tab v="user" label="Personas" icon={<Users size={16} weight={type === 'user' ? 'fill' : 'regular'} />} />
        </div>
      )}

      <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {([
          ['comentado', 'Más publicaciones'],
          ['popular', 'Más seguidos'],
          ['reciente', 'Más nuevos'],
          ['antiguo', 'Más antiguos'],
          ['menos_popular', 'Menos seguidos'],
          ['menos_comentado', 'Menos publicaciones'],
        ] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setSort(k)}
            className={`chip shrink-0 cursor-pointer ${sort === k ? 'is-on' : ''}`}
            style={{ padding: '6px 13px', fontSize: 13, minHeight: 0 }}>{label}</button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
        {items.map((s) => (
          <div key={s.id} className="flex flex-col items-center text-center gap-3 p-5 rounded-2xl rise" style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}>
            <a href={`/@${s.handle}`} data-hover-handle={s.handle}>
              {s.avatarUrl
                ? <img src={s.avatarUrl} alt="" className={`w-16 h-16 object-cover ${s.type === 'user' ? 'rounded-full' : 'rounded-2xl'}`} />
                : <span className={`grid place-items-center w-16 h-16 text-xl font-semibold ${s.type === 'user' ? 'rounded-full' : 'rounded-2xl'}`} style={{ background: 'var(--soft)', color: 'var(--blue)' }}>{(s.displayName || s.handle)[0]?.toUpperCase()}</span>}
            </a>
            <a href={`/@${s.handle}`} data-hover-handle={s.handle} className="min-w-0 w-full">
              <span className="block text-[15px] font-semibold truncate">{s.displayName || s.handle}</span>
              <span className="block t-caption">
                {s.postsCount > 0 ? `${Number(s.postsCount).toLocaleString('es')} publicaciones` : `@${s.handle}`}
              </span>
            </a>
            <FollowButton handle={s.handle} initialFollowing={s.viewerFollows} logged={logged} followers={s.followersCount || 0} />
          </div>
        ))}
        {loading && items.length === 0 && Array.from({ length: 8 }).map((_, i) => <div key={`s${i}`} className="skeleton h-[196px] rounded-2xl" />)}
      </div>

      {hasMore && <div ref={sentinel} className="py-10 text-center t-caption">{loading ? 'Cargando…' : ' '}</div>}
      {!hasMore && items.length > 0 && <p className="text-center t-caption py-10">No hay más resultados.</p>}
      {!loading && items.length === 0 && <p className="text-center t-body ink-2 py-16">Sin resultados.</p>}
    </div>
  )
}
export default Directory
