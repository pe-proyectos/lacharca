import React, { useEffect, useState } from 'react'
import { useT, locUi } from '../i18n'
import cat from '../i18n/catalogos/panel'

interface Live {
  online: number; identificados: number; anonimos: number; movil: number
  rutas: { path: string; n: number }[]; usuarios: string[]
}
interface Stats {
  dias: number
  totales: { pageviews?: number; visitantes?: number; sesiones?: number; identificados?: number }
  serie: { dia: string; pageviews: number; visitantes: number; sesiones: number; identificados: number }[]
  rutas: { path: string; n: number; visitantes: number }[]
  origenes: { host: string; n: number }[]
  dispositivos: { device: string; n: number }[]
  paises: { country: string; n: number }[]
  recurrencia: { tramo: string; visitantes: number }[]
}

const num = (n: number | undefined) => Number(n || 0).toLocaleString(locUi())

function Barras({ serie }: { serie: Stats['serie'] }) {
  const t = useT(cat)
  if (!serie.length) return <p className="t-sub">{t('sin_datos_suficientes')}</p>
  const max = Math.max(...serie.map((d) => d.visitantes), 1)
  return (
    <div className="flex items-end gap-[3px] h-[140px]">
      {serie.map((d) => (
        <div key={d.dia} className="flex-1 min-w-[4px] flex flex-col justify-end group relative">
          <div
            title={t('barra', { fecha: new Date(d.dia).toLocaleDateString(t.locale), visitantes: num(d.visitantes), paginas: num(d.pageviews) })}
            style={{ height: `${Math.max(2, (d.visitantes / max) * 100)}%`, background: 'var(--blue)', borderRadius: '3px 3px 0 0' }}
          />
        </div>
      ))}
    </div>
  )
}

function Lista({ titulo, filas, vacio }: { titulo: string; filas: [string, number][]; vacio: string }) {
  const max = Math.max(...filas.map((f) => f[1]), 1)
  return (
    <section>
      <h2 className="t-body font-semibold mb-3">{titulo}</h2>
      {filas.length === 0 ? <p className="t-sub">{vacio}</p> : (
        <div className="space-y-1">
          {filas.map(([k, v]) => (
            <div key={k} className="relative flex items-center justify-between px-2 py-1.5 rounded-lg text-[13px]">
              <div className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${(v / max) * 100}%`, background: 'var(--soft)' }} />
              <span className="relative truncate pr-3">{k}</span>
              <span className="relative tabular-nums ink-2">{num(v)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function TelemetryPanel() {
  const t = useT(cat)
  const [live, setLive] = useState<Live | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [dias, setDias] = useState(30)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    const cargar = async () => {
      try {
        const r = await fetch('/api/t/live', { credentials: 'same-origin' })
        const j = await r.json()
        if (!vivo) return
        if (j?.status) { setLive(j.data); setError(null) } else setError(t('sin_permiso'))
      } catch { if (vivo) setError(t('sin_conexion')) }
    }
    cargar()
    const timer = setInterval(cargar, 5000)
    return () => { vivo = false; clearInterval(timer) }
  }, [])

  useEffect(() => {
    let vivo = true
    fetch(`/api/t/stats?days=${dias}`, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((j) => { if (vivo && j?.status) setStats(j.data) })
      .catch(() => {})
    return () => { vivo = false }
  }, [dias])

  if (error) return <p className="t-body ink-2">{error}</p>

  const tot = stats?.totales || {}
  const pvPorVisitante = tot.visitantes ? (Number(tot.pageviews) / Number(tot.visitantes)) : 0

  return (
    <div className="space-y-10">
      {/* AHORA MISMO */}
      <section>
        <div className="flex items-baseline gap-3 mb-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: live?.online ? '#22c55e' : 'var(--line)' }} />
          <span className="text-[44px] font-semibold tabular-nums leading-none">{num(live?.online)}</span>
          <span className="t-sub">{t('ahora_mismo')}</span>
        </div>
        <p className="t-sub">
          {t('live_resumen', { id: num(live?.identificados), anon: num(live?.anonimos), movil: num(live?.movil) })}
          <span className="ink-3"> · {t('se_actualiza')}</span>
        </p>

        {!!live?.rutas?.length && (
          <div className="mt-5 grid sm:grid-cols-2 gap-x-8 gap-y-1">
            {live.rutas.map((r) => (
              <div key={r.path} className="flex justify-between text-[13px] py-1" style={{ borderBottom: '1px solid var(--line)' }}>
                <span className="truncate pr-3">{r.path}</span>
                <span className="tabular-nums ink-2">{r.n}</span>
              </div>
            ))}
          </div>
        )}

        {!!live?.usuarios?.length && (
          <p className="t-sub mt-4">{t('conectados', { lista: live.usuarios.map((h) => `@${h}`).join(', ') })}</p>
        )}
      </section>

      {/* RANGO */}
      <div className="flex gap-2">
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDias(d)}
            className="px-3 py-1.5 rounded-lg text-[13px]"
            style={d === dias ? { background: 'var(--active)', fontWeight: 600 } : { color: 'var(--ink-2)' }}>
            {t('dias', { n: d })}
          </button>
        ))}
      </div>

      {/* TOTALES */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          [t('visitantes'), num(tot.visitantes), t('personas_distintas')],
          [t('visitas'), num(tot.sesiones), t('sesiones_abiertas')],
          [t('paginas_vistas'), num(tot.pageviews), t('por_visitante', { n: pvPorVisitante.toLocaleString(t.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })],
          [t('con_cuenta'), num(tot.identificados), t('usuarios_registrados')],
        ].map(([k, v, sub]) => (
          <div key={k as string} className="p-4 rounded-xl" style={{ background: 'var(--surface)' }}>
            <p className="t-sub">{k}</p>
            <p className="text-[26px] font-semibold tabular-nums leading-tight">{v}</p>
            <p className="t-sub ink-3">{sub}</p>
          </div>
        ))}
      </section>

      {stats && (
        <>
          <section>
            <h2 className="t-body font-semibold mb-3">{t('visitantes_dia')}</h2>
            <Barras serie={stats.serie} />
          </section>

          <div className="grid sm:grid-cols-2 gap-10">
            <Lista titulo={t('paginas_mas_vistas')} vacio={t('sin_datos')}
              filas={stats.rutas.map((r) => [r.path, r.n] as [string, number])} />
            <Lista titulo={t('de_donde')} vacio={t('nadie_enlazado')}
              filas={stats.origenes.map((r) => [r.host, r.n] as [string, number])} />
            <Lista titulo={t('dispositivo')} vacio={t('sin_datos')}
              filas={stats.dispositivos.map((r) => [t('dispositivo_nombre', { k: r.device }), r.n] as [string, number])} />
            <Lista titulo={t('pais')} vacio={t('sin_pais')}
              filas={stats.paises.map((r) => [r.country, r.n] as [string, number])} />
          </div>

          <section>
            <h2 className="t-body font-semibold mb-1">{t('cuanto_navegan')}</h2>
            <p className="t-sub mb-3">
              {t('cuanto_desc')}
            </p>
            <div className="space-y-1">
              {stats.recurrencia
                .slice()
                .sort((a, b) => b.visitantes - a.visitantes)
                .map((r) => (
                  <div key={r.tramo} className="flex justify-between text-[13px] py-1.5" style={{ borderBottom: '1px solid var(--line)' }}>
                    <span>{t('tramo', { k: r.tramo })}</span>
                    <span className="tabular-nums ink-2">{t('n_visitantes', { n: num(r.visitantes), c: r.visitantes })}</span>
                  </div>
                ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
