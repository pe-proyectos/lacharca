import React, { useEffect, useState } from 'react'
import { LockKey, Timer, CheckCircle } from '@phosphor-icons/react'
import { hilosApi } from '../lib/hilosClient'

export interface PollData {
  id: number; options: string[]; votesCount: number; endsAt: string | null
  closed: boolean; results: number[] | null; myVote: number | null
}
export interface RevealData { at: string; locked: boolean }
export interface CountdownData { at: string; label: string | null }

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

// Cuenta atrás viva: se actualiza sola hasta llegar a cero.
const restante = (hasta: string) => {
  const ms = new Date(hasta).getTime() - Date.now()
  if (ms <= 0) return null
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  return { d, h, m, s: seg }
}

export const Countdown: React.FC<{ data: CountdownData }> = ({ data }) => {
  const [t, setT] = useState(() => restante(data.at))
  useEffect(() => {
    const id = setInterval(() => setT(restante(data.at)), 1000)
    return () => clearInterval(id)
  }, [data.at])

  const partes = t
    ? [
        ...(t.d > 0 ? [[t.d, t.d === 1 ? 'día' : 'días']] : []),
        [t.h, 'h'], [t.m, 'min'], ...(t.d > 0 ? [] : [[t.s, 'seg']]),
      ]
    : []

  return (
    <div className="mt-3 rounded-2xl p-4" style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}>
      <p className="eyebrow inline-flex items-center gap-1.5 mb-2"><Timer size={13} weight="fill" /> Cuenta atrás</p>
      {data.label && <p className="text-[15px] font-medium mb-2">{data.label}</p>}
      {t ? (
        <div className="flex items-end gap-4">
          {partes.map(([v, etiqueta]: any) => (
            <span key={etiqueta}>
              <b className="block text-[26px] font-semibold tabular-nums leading-none">{v}</b>
              <span className="t-caption">{etiqueta}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[15px] font-medium" style={{ color: 'var(--blue)' }}>Ya llegó el momento</p>
      )}
      <p className="t-caption mt-2">{new Date(data.at).toLocaleString('es', { dateStyle: 'long', timeStyle: 'short' })}</p>
    </div>
  )
}

export const Reveal: React.FC<{ data: RevealData }> = ({ data }) => {
  const [t, setT] = useState(() => restante(data.at))
  useEffect(() => {
    if (!data.locked) return
    const id = setInterval(() => setT(restante(data.at)), 1000)
    return () => clearInterval(id)
  }, [data.at, data.locked])

  if (!data.locked) return null

  return (
    <div className="mt-3 rounded-2xl p-4 text-center" style={{ border: '1px dashed var(--line)', background: 'var(--surface-2)' }}>
      <LockKey size={22} className="ink-3 mx-auto mb-2" />
      <p className="t-body ink-2">Este mensaje se abre el {new Date(data.at).toLocaleString('es', { dateStyle: 'long', timeStyle: 'short' })}</p>
      {t && (
        <p className="t-sub mt-1 tabular-nums">
          Faltan {t.d > 0 ? `${t.d} d ` : ''}{t.h} h {t.m} min{t.d > 0 ? '' : ` ${t.s} s`}
        </p>
      )}
    </div>
  )
}

export const Poll: React.FC<{ postId: number; data: PollData; logged: boolean }> = ({ postId, data, logged }) => {
  const [poll, setPoll] = useState(data)
  const [enviando, setEnviando] = useState<number | null>(null)

  const total = poll.results ? poll.results.reduce((a, b) => a + b, 0) : poll.votesCount
  const yaVote = poll.myVote !== null && poll.myVote !== undefined
  const muestraResultados = yaVote || poll.closed

  const votar = async (i: number) => {
    if (!logged) { window.location.href = '/auth/login'; return }
    if (poll.closed || enviando !== null) return
    setEnviando(i)
    // Optimista: el voto se pinta ya y se reconcilia con lo que diga el motor.
    const previos = poll.results ? [...poll.results] : poll.options.map(() => 0)
    const conMiVoto = [...previos]
    if (yaVote && poll.myVote !== null) conMiVoto[poll.myVote] = Math.max(0, conMiVoto[poll.myVote] - 1)
    conMiVoto[i] += 1
    setPoll({ ...poll, results: conMiVoto, myVote: i, votesCount: yaVote ? poll.votesCount : poll.votesCount + 1 })
    try {
      const r = await hilosApi.vote(postId, i)
      setPoll((p) => ({ ...p, results: r.results, votesCount: r.votesCount, myVote: r.myVote }))
    } catch {
      setPoll({ ...poll, results: previos })
    } finally { setEnviando(null) }
  }

  return (
    <div className="mt-3 space-y-2">
      {poll.options.map((op, i) => {
        const votos = poll.results?.[i] ?? 0
        const porcentaje = pct(votos, total)
        const mio = poll.myVote === i
        return (
          <button key={i} type="button" onClick={() => votar(i)} disabled={poll.closed}
            className="relative w-full text-left rounded-xl overflow-hidden transition disabled:cursor-default"
            style={{ border: `1px solid ${mio ? 'var(--blue)' : 'var(--line)'}`, background: 'var(--surface)' }}>
            {muestraResultados && (
              <span className="absolute inset-y-0 left-0" style={{ width: `${porcentaje}%`, background: mio ? 'var(--soft)' : 'var(--surface-2)' }} />
            )}
            <span className="relative flex items-center justify-between gap-3 px-3.5 py-2.5">
              <span className="text-[15px] inline-flex items-center gap-1.5 min-w-0">
                {mio && <CheckCircle size={15} weight="fill" style={{ color: 'var(--blue)' }} />}
                <span className="truncate">{op}</span>
              </span>
              {muestraResultados && <span className="t-caption tabular-nums shrink-0">{porcentaje}%</span>}
            </span>
          </button>
        )
      })}
      <p className="t-caption">
        {total} {total === 1 ? 'voto' : 'votos'}
        {poll.closed
          ? ' · cerrada'
          : poll.endsAt
            ? ` · cierra el ${new Date(poll.endsAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}`
            : ''}
        {!yaVote && !poll.closed ? ' · toca una opción para votar' : ''}
      </p>
    </div>
  )
}
