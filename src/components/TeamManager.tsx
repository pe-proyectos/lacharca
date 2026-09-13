import React, { useEffect, useState } from 'react'
import { Crown, ShieldCheck, Trash, UserPlus, Warning } from '@phosphor-icons/react'

interface Page { handle: string; type?: string; displayName?: string | null; avatarUrl?: string | null }
interface Miembro { role: 'owner' | 'trusted'; since?: string; page: Page }

const ERRORES: Record<string, string> = {
  last_owner: 'No puedes quitar al último propietario: el scan quedaría sin nadie que lo administre.',
  forbidden: 'Solo un propietario puede cambiar el equipo.',
  page_not_found: 'No encontramos esa cuenta en La Charca.',
  cannot_add_self: 'El scan no puede pertenecer a su propio equipo.',
  not_found: 'Esa persona no está en el equipo.',
}

const Avatar = ({ p, size = 42 }: { p: Page; size?: number }) =>
  p.avatarUrl
    ? <img src={p.avatarUrl} alt="" style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />
    : <span style={{ width: size, height: size, background: 'var(--soft)', color: 'var(--blue)' }}
        className="grid place-items-center shrink-0 rounded-full text-[15px] font-semibold">
        {(p.displayName || p.handle)[0]?.toUpperCase()}
      </span>

// Equipo de un scan. Un propietario reparte los papeles; quien es de confianza
// puede publicar en nombre del scan pero no tocar el equipo.
const TeamManager: React.FC<{ scan: string; me: string }> = ({ scan, me }) => {
  const [miembros, setMiembros] = useState<Miembro[] | null>(null)
  const [nuevo, setNuevo] = useState('')
  const [rolNuevo, setRolNuevo] = useState<'owner' | 'trusted'>('trusted')
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const cargar = () =>
    fetch(`/api/pages/${encodeURIComponent(scan)}/members`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => setMiembros(j?.status ? j.data : []))
      .catch(() => setMiembros([]))

  useEffect(() => { cargar() }, [scan])

  const soyOwner = !!miembros?.find((m) => m.page.handle === me && m.role === 'owner')
  const owners = miembros?.filter((m) => m.role === 'owner').length || 0

  const añadir = async () => {
    const handle = nuevo.trim().toLowerCase().replace(/^@/, '')
    if (!handle || busy) return
    setBusy(true); setErr(null); setOk(null)
    try {
      const res = await fetch(`/api/pages/${encodeURIComponent(scan)}/members`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, role: rolNuevo }),
      })
      const j = await res.json()
      if (!j?.status) throw new Error(j?.message || 'error')
      setNuevo(''); setOk(`@${handle} ya forma parte del equipo`); await cargar()
    } catch (e: any) {
      setErr(ERRORES[e?.message] || 'No se pudo añadir a esa persona.')
    } finally { setBusy(false) }
  }

  const quitar = async (m: Miembro) => {
    const propio = m.page.handle === me
    const aviso = propio
      ? '¿Salir del equipo? Dejarás de poder publicar como este scan.'
      : `¿Quitar a @${m.page.handle} del equipo?`
    if (!confirm(aviso)) return
    setErr(null); setOk(null)
    try {
      const res = await fetch(`/api/pages/${encodeURIComponent(scan)}/members/${encodeURIComponent(m.page.handle)}`, {
        method: 'DELETE', credentials: 'include',
      })
      const j = await res.json()
      if (!j?.status) throw new Error(j?.message || 'error')
      if (propio) { window.location.href = '/'; return }
      await cargar()
    } catch (e: any) {
      setErr(ERRORES[e?.message] || 'No se pudo quitar a esa persona.')
    }
  }

  const cambiarRol = async (m: Miembro, role: 'owner' | 'trusted') => {
    setErr(null); setOk(null)
    try {
      const res = await fetch(`/api/pages/${encodeURIComponent(scan)}/members`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: m.page.handle, role }),
      })
      const j = await res.json()
      if (!j?.status) throw new Error(j?.message || 'error')
      await cargar()
    } catch (e: any) {
      setErr(ERRORES[e?.message] || 'No se pudo cambiar el papel.')
    }
  }

  if (miembros === null) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="skeleton rounded-full" style={{ width: 42, height: 42 }} />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3.5 w-1/3 rounded" />
              <div className="skeleton h-3 w-1/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {soyOwner && (
        <div className="rounded-2xl p-4 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
          <p className="text-[15px] font-medium mb-1">Añadir a alguien</p>
          <p className="t-sub mb-3">Escribe su @usuario de La Charca. Debe tener cuenta creada.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input value={nuevo} onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') añadir() }}
              placeholder="@usuario"
              className="flex-1 min-w-[180px] rounded-xl px-3.5 py-2.5 text-[15px] focus:outline-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }} />
            <select value={rolNuevo} onChange={(e) => setRolNuevo(e.target.value as any)}
              className="rounded-xl px-3 py-2.5 text-[14px] focus:outline-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
              <option value="trusted">De confianza</option>
              <option value="owner">Propietario</option>
            </select>
            <button type="button" onClick={añadir} disabled={busy || !nuevo.trim()}
              className="btn inline-flex items-center gap-2 disabled:opacity-40 cursor-pointer">
              <UserPlus size={16} weight="fill" /> Añadir
            </button>
          </div>
        </div>
      )}

      {err && <p className="mb-4 text-[14px] rounded-xl px-3.5 py-2.5 inline-flex items-center gap-2"
        style={{ color: 'var(--danger)', background: 'var(--danger-bg)', border: '1px solid var(--danger-line)' }}>
        <Warning size={16} weight="fill" /> {err}
      </p>}
      {ok && <p className="mb-4 t-sub" style={{ color: 'var(--ok)' }}>{ok}</p>}

      <div>
        {miembros.map((m) => {
          const esYo = m.page.handle === me
          const ultimoOwner = m.role === 'owner' && owners <= 1
          return (
            <div key={m.page.handle} className="row flex items-center gap-3.5 py-4" style={{ borderBottom: '1px solid var(--line)' }}>
              <a href={`/@${m.page.handle}`} data-hover-handle={m.page.handle} className="shrink-0"><Avatar p={m.page} /></a>
              <a href={`/@${m.page.handle}`} data-hover-handle={m.page.handle} className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium truncate">
                  {m.page.displayName || m.page.handle}{esYo && <span className="t-caption"> · tú</span>}
                </span>
                <span className="t-caption inline-flex items-center gap-1.5">
                  {m.role === 'owner'
                    ? <><Crown size={13} weight="fill" style={{ color: 'var(--blue)' }} /> Propietario</>
                    : <><ShieldCheck size={13} /> De confianza</>}
                </span>
              </a>

              {soyOwner && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {m.role === 'trusted' ? (
                    <button type="button" onClick={() => cambiarRol(m, 'owner')} className="chip cursor-pointer"
                      style={{ padding: '5px 12px', fontSize: 13, minHeight: 0 }}>Hacer propietario</button>
                  ) : (
                    <button type="button" onClick={() => cambiarRol(m, 'trusted')} disabled={ultimoOwner}
                      title={ultimoOwner ? 'Es el único propietario' : undefined}
                      className="chip cursor-pointer disabled:opacity-40"
                      style={{ padding: '5px 12px', fontSize: 13, minHeight: 0 }}>Quitar propiedad</button>
                  )}
                  <button type="button" onClick={() => quitar(m)} disabled={ultimoOwner}
                    title={ultimoOwner ? 'No puede quedarse sin propietario' : 'Quitar del equipo'}
                    aria-label="Quitar del equipo" className="icon-btn shrink-0 disabled:opacity-30">
                    <Trash size={16} />
                  </button>
                </div>
              )}

              {!soyOwner && esYo && (
                <button type="button" onClick={() => quitar(m)} disabled={ultimoOwner}
                  className="chip cursor-pointer shrink-0" style={{ padding: '5px 12px', fontSize: 13, minHeight: 0 }}>Salir</button>
              )}
            </div>
          )
        })}
      </div>

      {!soyOwner && (
        <p className="t-sub mt-5">
          Puedes publicar y responder en nombre de este scan. Solo un propietario puede cambiar el equipo.
        </p>
      )}
    </div>
  )
}
export default TeamManager
