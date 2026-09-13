import React, { useEffect, useRef, useState } from 'react'
import { CaretUpDown, Check, Users, ArrowSquareOut } from '@phosphor-icons/react'
import { hilosApi, getIdentity, setIdentity } from '../lib/hilosClient'

interface Page {
  handle: string; type?: string; displayName?: string | null; avatarUrl?: string | null
}
interface Identidad { role: 'owner' | 'trusted'; page: Page }

const Avatar = ({ p, size = 36 }: { p: { avatarUrl?: string | null; displayName?: string | null; handle: string; type?: string }; size?: number }) =>
  p.avatarUrl
    ? <img src={p.avatarUrl} alt="" style={{ width: size, height: size }} className={`object-cover shrink-0 ${p.type === 'user' ? 'rounded-full' : 'rounded-xl'}`} />
    : <span style={{ width: size, height: size, background: 'var(--soft)', color: 'var(--blue)' }}
        className={`grid place-items-center shrink-0 text-[13px] font-semibold ${p.type === 'user' ? 'rounded-full' : 'rounded-xl'}`}>
        {(p.displayName || p.handle)[0]?.toUpperCase()}
      </span>

// Permite publicar y responder como tu cuenta o como uno de los scans que
// administras. Lo que se elige aquí manda en todo lo que escribas después.
const IdentitySwitcher: React.FC<{ user: Page }> = ({ user }) => {
  const [abierto, setAbierto] = useState(false)
  const [scans, setScans] = useState<Identidad[] | null>(null)
  const [activo, setActivo] = useState<string | null>(null)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => { setActivo(getIdentity()) }, [])

  useEffect(() => {
    if (!abierto || scans) return
    hilosApi.identities().then((d: Identidad[]) => setScans(d || [])).catch(() => setScans([]))
  }, [abierto, scans])

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [])

  // Cargamos al inicio para saber si hay algo que elegir (y no enseñar una
  // flecha que abre una lista vacía).
  useEffect(() => {
    hilosApi.identities().then((d: Identidad[]) => setScans(d || [])).catch(() => setScans([]))
  }, [])

  const elegir = (handle: string | null) => {
    setIdentity(handle)
    setActivo(handle)
    setAbierto(false)
    window.location.reload() // el servidor pinta el feed con la identidad activa
  }

  const actual = activo ? scans?.find((s) => s.page.handle === activo)?.page : null
  const mostrado = actual || user
  const hayScans = (scans?.length || 0) > 0

  return (
    <div ref={caja} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => hayScans && setAbierto((o) => !o)}
        className={`flex items-center gap-3 min-w-0 w-full text-left ${hayScans ? 'cursor-pointer' : 'cursor-default'}`}
        title={hayScans ? 'Cambiar de identidad' : undefined}
        aria-haspopup={hayScans ? 'menu' : undefined}
        aria-expanded={abierto}
      >
        <Avatar p={mostrado} />
        <span className="hidden xl:block min-w-0 flex-1">
          <span className="block text-[15px] font-medium truncate">{mostrado.displayName || mostrado.handle}</span>
          <span className="block t-caption truncate">
            {actual ? `actuando como @${actual.handle}` : `@${user.handle}`}
          </span>
        </span>
        {hayScans && <CaretUpDown size={16} className="ink-3 shrink-0 hidden xl:block" />}
      </button>

      {abierto && (
        <div className="absolute bottom-full mb-2 left-0 w-[264px] rounded-2xl overflow-hidden z-50 rise"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: '0 14px 40px var(--shadow)' }}>
          <p className="eyebrow px-4 pt-3 pb-2">Publicar como</p>

          <button type="button" onClick={() => elegir(null)} className="row w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer">
            <Avatar p={user} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium truncate">{user.displayName || user.handle}</span>
              <span className="block t-caption">Tu cuenta</span>
            </span>
            {!activo && <Check size={16} weight="bold" style={{ color: 'var(--blue)' }} />}
          </button>

          {(scans || []).map((s) => (
            <div key={s.page.handle} className="row flex items-center gap-1 px-2">
              <button type="button" onClick={() => elegir(s.page.handle)} className="flex items-center gap-3 px-2 py-2.5 flex-1 min-w-0 text-left cursor-pointer">
                <Avatar p={s.page} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium truncate">{s.page.displayName || s.page.handle}</span>
                  <span className="block t-caption">{s.role === 'owner' ? 'Propietario' : 'De confianza'}</span>
                </span>
                {activo === s.page.handle && <Check size={16} weight="bold" style={{ color: 'var(--blue)' }} />}
              </button>
              <a href={`/@${s.page.handle}`} title="Ir al perfil del scan" aria-label="Ir al perfil del scan"
                className="icon-btn shrink-0" style={{ width: 32, height: 32 }}>
                <ArrowSquareOut size={15} />
              </a>
            </div>
          ))}

          {activo && (
            <a href={`/@${activo}/equipo`} className="row flex items-center gap-2.5 px-4 py-2.5 t-caption border-t" style={{ borderColor: 'var(--line)' }}>
              <Users size={15} /> Gestionar el equipo
            </a>
          )}
        </div>
      )}
    </div>
  )
}
export default IdentitySwitcher
