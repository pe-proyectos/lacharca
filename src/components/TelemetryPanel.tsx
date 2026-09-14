import React, { useEffect, useState } from 'react'

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

const num = (n: number | undefined) => Number(n || 0).toLocaleString('es')

function Barras({ serie }: { serie: Stats['serie'] }) {
  if (!serie.length) return <p className="t-sub">Todavía no hay datos suficientes.</p>
  const max = Math.max(...serie.map((d) => d.visitantes), 1)
  return (
    <div className="flex items-end gap-[3px] h-[140px]">
      {serie.map((d) => (
        <div key={d.dia} className="flex-1 min-w-[4px] flex flex-col justify-end group relative">
          <div
            title={`${new Date(d.dia).toLocaleDateString('es')}: ${num(d.visitantes)} visitantes, ${num(d.pageviews)} páginas`}
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
        if (j?.status) { setLive(j.data); setError(null) } else setError('Sin permiso para ver estos datos.')
      } catch { if (vivo) setError('No se pudo conectar.') }
    }
    cargar()
    const t = setInterval(cargar, 5000)
    return () => { vivo = false; clearInterval(t) }
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

  const t = stats?.totales || {}
  const pvPorVisitante = t.visitantes ? (Number(t.pageviews) / Number(t.visitantes)) : 0

  return (
    <div className="space-y-10">
      {/* AHORA MISMO */}
      <section>
        <div className="flex items-baseline gap-3 mb-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: live?.online ? '#22c55e' : 'var(--line)' }} />
          <span className="text-[44px] font-semibold tabular-nums leading-none">{num(live?.online)}</span>
          <span className="t-sub">ahora mismo</span>
        </div>
        <p className="t-sub">
          {num(live?.identificados)} con sesión iniciada · {num(live?.anonimos)} sin cuenta · {num(live?.movil)} en móvil
          <span className="ink-3"> · se actualiza cada 5 s</span>
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
          <p className="t-sub mt-4">Conectados: {live.usuarios.map((h) => `@${h}`).join(', ')}</p>
        )}
      </section>

      {/* RANGO */}
      <div className="flex gap-2">
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDias(d)}
            className="px-3 py-1.5 rounded-lg text-[13px]"
            style={d === dias ? { background: 'var(--active)', fontWeight: 600 } : { color: 'var(--ink-2)' }}>
            {d} días
          </button>
        ))}
      </div>

      {/* TOTALES */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          ['Visitantes', num(t.visitantes), 'personas distintas'],
          ['Visitas', num(t.sesiones), 'sesiones abiertas'],
          ['Páginas vistas', num(t.pageviews), `${pvPorVisitante.toFixed(1)} por visitante`],
          ['Con cuenta', num(t.identificados), 'usuarios registrados'],
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
            <h2 className="t-body font-semibold mb-3">Visitantes por día</h2>
            <Barras serie={stats.serie} />
          </section>

          <div className="grid sm:grid-cols-2 gap-10">
            <Lista titulo="Páginas más vistas" vacio="Sin datos."
              filas={stats.rutas.map((r) => [r.path, r.n] as [string, number])} />
            <Lista titulo="De dónde llegan" vacio="Nadie nos ha enlazado todavía."
              filas={stats.origenes.map((r) => [r.host, r.n] as [string, number])} />
            <Lista titulo="Dispositivo" vacio="Sin datos."
              filas={stats.dispositivos.map((r) => [r.device, r.n] as [string, number])} />
            <Lista titulo="País" vacio="El proxy no envía el país."
              filas={stats.paises.map((r) => [r.country, r.n] as [string, number])} />
          </div>

          <section>
            <h2 className="t-body font-semibold mb-1">Cuánto navegan</h2>
            <p className="t-sub mb-3">
              Quien ve una sola página suele ser tráfico de paso. El resto está usando la red de verdad.
            </p>
            <div className="space-y-1">
              {stats.recurrencia
                .slice()
                .sort((a, b) => b.visitantes - a.visitantes)
                .map((r) => (
                  <div key={r.tramo} className="flex justify-between text-[13px] py-1.5" style={{ borderBottom: '1px solid var(--line)' }}>
                    <span>{r.tramo}</span>
                    <span className="tabular-nums ink-2">{num(r.visitantes)} visitantes</span>
                  </div>
                ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
