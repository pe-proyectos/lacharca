import React, { useCallback, useEffect, useState } from 'react'
import { MagnifyingGlass, ArrowSquareOut, BookOpen } from '@phosphor-icons/react'
import { useT, locUi } from '../i18n'
import { capibara } from '../i18n/capibara'
import { followers } from '../lib/format'
import cat from '../i18n/catalogos/equipo'

interface Page {
  handle: string; type?: string; displayName?: string | null; avatarUrl?: string | null
  postsCount?: number; followersCount?: number; externalId?: string | null
}

const n = (v: any) => Number(v || 0).toLocaleString(locUi())

// Las obras que cuelgan de un scan. Se crean solas al publicar capítulos desde
// CapibaraTraductor, así que aquí se consultan y se saltan a ellas, no se
// inventan a mano.
const SubpageManager: React.FC<{ scan: string }> = ({ scan }) => {
  const t = useT(cat)
  const [items, setItems] = useState<Page[] | null>(null)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [cargando, setCargando] = useState(false)

  const cargar = useCallback(async (p: number, texto: string, añadir: boolean) => {
    setCargando(true)
    try {
      const res = await fetch(`/api/pages/${encodeURIComponent(scan)}/subpages?page=${p}&limit=30${texto ? `&q=${encodeURIComponent(texto)}` : ''}`, { credentials: 'include' })
      const j = await res.json()
      const d = j?.data || { items: [], hasMore: false, total: 0 }
      setItems((prev) => (añadir ? [...(prev || []), ...d.items] : d.items))
      setHasMore(!!d.hasMore)
      setTotal(d.total ?? d.items.length)
      setPage(p)
    } catch { if (!añadir) setItems([]) } finally { setCargando(false) }
  }, [scan])

  useEffect(() => { cargar(0, '', false) }, [cargar])

  useEffect(() => {
    const espera = setTimeout(() => cargar(0, q.trim(), false), 300)
    return () => clearTimeout(espera)
  }, [q, cargar])

  return (
    <div>
      <div className="flex items-center gap-2 mb-5 px-3.5 py-2.5 rounded-xl max-w-md"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
        <MagnifyingGlass size={17} className="ink-3 shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('buscar_obra')}
          className="flex-1 bg-transparent text-[15px] focus:outline-none" />
      </div>

      {items !== null && <p className="t-sub mb-4">{t('obras_en_scan', { n: n(total), c: total })}</p>}

      {items === null ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3.5 py-3">
            <div className="skeleton rounded-xl" style={{ width: 46, height: 46 }} />
            <div className="flex-1 space-y-2"><div className="skeleton h-3.5 w-2/5 rounded" /><div className="skeleton h-3 w-1/5 rounded" /></div>
          </div>))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <BookOpen size={30} className="ink-3 mx-auto mb-3" />
          <p className="t-body ink-2">{q ? t('ninguna_coincide') : t('sin_obras')}</p>
          {!q && <p className="t-sub mt-1">{t('se_crean', { marca: capibara().marca })}</p>}
        </div>
      ) : (
        <div>
          {items.map((p) => (
            <div key={p.handle} className="row flex items-center gap-3.5 py-4" style={{ borderBottom: '1px solid var(--line)' }}>
              <a href={`/@${scan}/${p.handle}`} className="shrink-0">
                {p.avatarUrl
                  ? <img src={p.avatarUrl} alt="" style={{ width: 46, height: 46 }} className="rounded-xl object-cover" />
                  : <span style={{ width: 46, height: 46, background: 'var(--soft)', color: 'var(--blue)' }}
                      className="grid place-items-center rounded-xl text-[15px] font-semibold">{(p.displayName || p.handle)[0]?.toUpperCase()}</span>}
              </a>
              <a href={`/@${scan}/${p.handle}`} className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium truncate">{p.displayName || p.handle}</span>
                <span className="block t-caption truncate">
                  {t('capitulos', { n: n(p.postsCount), c: Number(p.postsCount || 0) })} · {followers(p.followersCount)}
                </span>
              </a>
              <a href={`/@${scan}/${p.handle}`} className="chip shrink-0 inline-flex items-center gap-1.5"
                style={{ padding: '6px 13px', fontSize: 13, minHeight: 0 }}>
                {t('ver')} <ArrowSquareOut size={13} />
              </a>
            </div>
          ))}

          {hasMore && (
            <button type="button" onClick={() => cargar(page + 1, q.trim(), true)} disabled={cargando}
              className="chip w-full justify-center mt-5 cursor-pointer">
              {cargando ? t('cargando') : t('ver_mas')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
export default SubpageManager
