import React, { useEffect, useRef, useState } from 'react'
import {
  CaretUpDown, Check, Users, ArrowSquareOut, BookOpen, ChatCircleDots,
  MagnifyingGlass, SignOut, Sun, Moon, Desktop,
} from '@phosphor-icons/react'
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
  const [busca, setBusca] = useState('')
  const [tema, setTema] = useState<'light' | 'dark' | 'system'>('system')
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => { setTema(((localStorage.getItem('lc-theme') as any) || 'system')) }, [])

  const cambiarTema = () => {
    const orden = ['light', 'dark', 'system'] as const
    const siguiente = orden[(orden.indexOf(tema) + 1) % orden.length]
    setTema(siguiente)
    localStorage.setItem('lc-theme', siguiente)
    const oscuro = siguiente === 'dark' || (siguiente === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.dataset.theme = oscuro ? 'dark' : 'light'
  }

  const IconoTema = tema === 'dark' ? Moon : tema === 'light' ? Sun : Desktop
  const NOMBRE_TEMA = { light: 'Claro', dark: 'Oscuro', system: 'Automático' }[tema]

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

  const elegir = (handle: string | null, page?: Page) => {
    setIdentity(handle, page)
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
        onClick={() => setAbierto((o) => !o)}
        className="flex items-center gap-3 min-w-0 w-full text-left cursor-pointer"
        title={hayScans ? 'Cambiar de identidad' : 'Opciones de tu cuenta'}
        aria-haspopup="menu"
        aria-expanded={abierto}
      >
        <Avatar p={mostrado} />
        <span className="hidden xl:block min-w-0 flex-1">
          <span className="block text-[15px] font-medium truncate">{mostrado.displayName || mostrado.handle}</span>
          <span className="block t-caption truncate">
            {actual ? `actuando como @${actual.handle}` : `@${user.handle}`}
          </span>
        </span>
        <CaretUpDown size={16} className="ink-3 shrink-0 hidden xl:block" />
      </button>

      {abierto && (
        <div className="absolute bottom-full mb-2 left-0 w-[264px] rounded-2xl overflow-hidden z-50 rise"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: '0 14px 40px var(--shadow)' }}>
          <p className="eyebrow px-4 pt-3 pb-2">Publicar como</p>

          {(scans?.length || 0) > 5 && (
            <div className="px-3 pb-2">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                <MagnifyingGlass size={15} className="ink-3" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus
                  placeholder="Buscar scan"
                  className="flex-1 bg-transparent text-[14px] focus:outline-none" />
              </div>
            </div>
          )}

          <div className="overflow-y-auto" style={{ maxHeight: 'min(46vh, 340px)' }}>
          <button type="button" onClick={() => elegir(null)} className="row w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer">
            <Avatar p={user} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium truncate">{user.displayName || user.handle}</span>
              <span className="block t-caption">Tu cuenta</span>
            </span>
            {!activo && <Check size={16} weight="bold" style={{ color: 'var(--blue)' }} />}
          </button>

          {(scans || [])
            .filter((s) => {
              const q = busca.trim().toLowerCase()
              if (!q) return true
              return `${s.page.displayName || ''} ${s.page.handle}`.toLowerCase().includes(q)
            })
            .map((s) => (
            <div key={s.page.handle} className="row flex items-center gap-1 px-2">
              <button type="button" onClick={() => elegir(s.page.handle, s.page)} className="flex items-center gap-3 px-2 py-2.5 flex-1 min-w-0 text-left cursor-pointer">
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
          </div>

          {activo && (
            <div className="border-t" style={{ borderColor: 'var(--line)' }}>
              <p className="eyebrow px-4 pt-3 pb-1.5">Administrar el scan</p>
              <a href={`/@${activo}/equipo`} className="row flex items-center gap-2.5 px-4 py-2.5 t-caption">
                <Users size={15} /> Equipo
              </a>
              <a href={`/@${activo}/obras`} className="row flex items-center gap-2.5 px-4 py-2.5 t-caption">
                <BookOpen size={15} /> Obras
              </a>
              <a href="/mensajes" className="row flex items-center gap-2.5 px-4 py-2.5 t-caption">
                <ChatCircleDots size={15} /> Bandeja del scan
              </a>
            </div>
          )}

          <div className="border-t" style={{ borderColor: 'var(--line)' }}>
            <button type="button" onClick={cambiarTema}
              className="row w-full flex items-center gap-2.5 px-4 py-2.5 t-caption text-left cursor-pointer">
              <IconoTema size={15} weight={tema === 'system' ? 'regular' : 'fill'} /> Tema: {NOMBRE_TEMA}
            </button>
            <a href="/auth/logout" className="row flex items-center gap-2.5 px-4 py-2.5 t-caption">
              <SignOut size={15} /> Cerrar sesión
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
export default IdentitySwitcher
