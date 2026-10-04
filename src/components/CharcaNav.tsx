import React, { useEffect, useRef, useState } from 'react'
import {
  House, UsersThree, MagnifyingGlass, ChatCircleDots, Bell, BookmarkSimple, User,
  Plus, X, CaretDown, CaretRight, Hash, Compass, Fire, ChatsCircle, Clock, Storefront,
  Users, BookOpen, Crown, DiscordLogo, ArrowSquareOut, ChartLine, SignIn, UserPlus,
  SignOut, List, UserList, Sparkle,
} from '@phosphor-icons/react'
import NotifBadge from './NotifBadge'
import ThemeToggle from './ThemeToggle'
import IdentitySwitcher from './IdentitySwitcher'
import LanguageSwitcher from './LanguageSwitcher'
import { useT } from '../i18n'
import { capibara as sitioCapibara } from '../i18n/capibara'
import cat from '../i18n/catalogos/nav'
import { getIdentity, getIdentityPage, type IdentityPage } from '../lib/hilosClient'

interface Viewer { handle: string; displayName?: string | null; avatarUrl?: string | null }

interface Props {
  active: string
  viewer: Viewer | null
  trending: string[]
  isAdmin: boolean
}

type Enlace = { href: string; label: string; desc?: string; Icon: any; external?: boolean; key?: string }

// Scan con el que estás actuando (lo elige IdentitySwitcher y vive en el
// navegador), para ofrecer sus accesos de administración.
function useScanActivo(): IdentityPage | null {
  const [page, setPage] = useState<IdentityPage | null>(null)
  useEffect(() => {
    const handle = getIdentity()
    setPage(handle ? (getIdentityPage() || { handle }) : null)
    const on = (e: any) => setPage(e?.detail?.handle ? (e.detail.page || { handle: e.detail.handle }) : null)
    window.addEventListener('lc:identity', on)
    return () => window.removeEventListener('lc:identity', on)
  }, [])
  return page
}

const Avatar = ({ v, size = 32 }: { v: Viewer; size?: number }) =>
  v.avatarUrl
    ? <img src={v.avatarUrl} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
    : <span className="grid place-items-center rounded-full shrink-0 text-[13px] font-semibold" style={{ width: size, height: size, background: 'var(--soft)', color: 'var(--blue)' }}>
        {(v.displayName || v.handle)[0]?.toUpperCase()}
      </span>

// Opción de un panel: icono en caja, título y una línea.
const Opcion = ({ e, onClick }: { e: Enlace; onClick?: () => void }) => (
  <a href={e.href} target={e.external ? '_blank' : undefined} rel={e.external ? 'noopener noreferrer' : undefined}
    onClick={onClick} className="nav-item group flex items-start gap-3 rounded-2xl p-3">
    <span className="grid place-items-center shrink-0 rounded-xl" style={{ width: 38, height: 38, background: 'var(--soft)', color: 'var(--blue)' }}>
      <e.Icon size={19} weight="duotone" />
    </span>
    <span className="min-w-0">
      <span className="flex items-center gap-1 text-[15px] font-semibold">
        {e.label}{e.external && <ArrowSquareOut size={12} className="ink-3" />}
      </span>
      {e.desc && <span className="block t-caption leading-snug">{e.desc}</span>}
    </span>
  </a>
)

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="eyebrow px-3 mb-2">{children}</p>
)

const CharcaNav: React.FC<Props> = ({ active, viewer, trending, isAdmin }) => {
  const t = useT(cat)
  const capi = sitioCapibara()
  const [panel, setPanel] = useState<null | 'explorar' | 'charca' | 'capibara'>(null)
  const [hoja, setHoja] = useState(false)
  const [q, setQ] = useState('')
  const cierre = useRef<ReturnType<typeof setTimeout> | null>(null)
  const raiz = useRef<HTMLDivElement>(null)
  const scan = useScanActivo()

  useEffect(() => {
    const fuera = (e: MouseEvent) => { if (raiz.current && !raiz.current.contains(e.target as Node)) setPanel(null) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPanel(null); setHoja(false) } }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [])

  useEffect(() => {
    if (!hoja) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [hoja])

  const abrir = (p: typeof panel) => { if (cierre.current) clearTimeout(cierre.current); setPanel(p) }
  const cerrarLuego = () => { if (cierre.current) clearTimeout(cierre.current); cierre.current = setTimeout(() => setPanel(null), 160) }

  const buscar = (e: React.FormEvent) => {
    e.preventDefault()
    const t = q.trim()
    window.location.href = t ? `/explorar?q=${encodeURIComponent(t)}` : '/explorar'
  }

  const publicarHref = viewer ? '/?compose=1' : '/auth/login'

  const descubrir: Enlace[] = [
    { href: '/explorar', label: t('explorar'), desc: t('explorar_desc'), Icon: Compass },
    { href: '/', label: t('nuevo'), desc: t('nuevo_desc'), Icon: Clock },
    { href: '/explorar?orden=popular', label: t('populares'), desc: t('populares_desc'), Icon: Fire },
    { href: '/explorar?orden=comentado', label: t('comentado'), desc: t('comentado_desc'), Icon: ChatsCircle },
    { href: '/scans', label: t('directorio'), desc: t('directorio_desc'), Icon: Storefront },
  ]

  const tuCharca: Enlace[] = viewer ? [
    { href: '/?feed=following', label: t('manada'), desc: t('manada_desc'), Icon: UsersThree },
    { href: `/@${viewer.handle}`, label: t('perfil'), desc: t('perfil_desc'), Icon: User },
    { href: '/guardados', label: t('guardados'), desc: t('guardados_desc'), Icon: BookmarkSimple },
    { href: '/mensajes', label: t('mensajes'), desc: t('mensajes_desc'), Icon: ChatCircleDots },
    { href: '/avisos', label: t('avisos'), desc: t('avisos_desc'), Icon: Bell },
    { href: `/@${viewer.handle}/seguidores`, label: t('seguidores'), desc: t('seguidores_desc'), Icon: UserList },
    { href: `/@${viewer.handle}/siguiendo`, label: t('siguiendo'), desc: t('siguiendo_desc'), Icon: Users },
    ...(isAdmin ? [{ href: '/panel', label: t('panel'), desc: t('panel_desc'), Icon: ChartLine }] : []),
  ] : []

  const deScan: Enlace[] = scan ? [
    { href: `/@${scan.handle}`, label: t('perfil_scan'), desc: scan.displayName || `@${scan.handle}`, Icon: Storefront },
    { href: `/@${scan.handle}/equipo`, label: t('equipo'), desc: t('equipo_desc'), Icon: Users },
    { href: `/@${scan.handle}/obras`, label: t('obras'), desc: t('obras_desc'), Icon: BookOpen },
  ] : []

  const capibara: Enlace[] = [
    { href: capi.url, label: t('leer_en', { marca: capi.marca }), desc: t('leer_en_desc'), Icon: BookOpen, external: true },
    { href: `${capi.url}/search?sort=popular`, label: t('populares'), desc: t('populares_capi_desc'), Icon: Fire, external: true },
    { href: `${capi.url}/subscriptions`, label: t('suscripcion'), desc: t('suscripcion_desc'), Icon: Crown, external: true },
    { href: capi.discord, label: 'Discord', desc: t('discord_desc'), Icon: DiscordLogo, external: true },
  ]

  const tabs = [
    { href: '/', label: t('inicio'), key: 'home', Icon: House },
    ...(viewer ? [{ href: '/?feed=following', label: t('manada'), key: 'following', Icon: UsersThree }] : []),
  ]

  const disparador = (p: 'explorar' | 'charca' | 'capibara', label: string, on = false) => (
    <button type="button" aria-expanded={panel === p} aria-haspopup="true"
      onMouseEnter={() => abrir(p)} onMouseLeave={cerrarLuego}
      onClick={() => setPanel(panel === p ? null : p)}
      className={`nav-item flex items-center gap-1 rounded-full px-3.5 py-2 text-[15px] ${panel === p || on ? 'font-semibold' : 'ink-2'}`}
      style={panel === p || on ? { background: 'var(--active)' } : undefined}>
      {label}
      <CaretDown size={13} weight="bold" className={`transition-transform ${panel === p ? 'rotate-180' : ''}`} />
    </button>
  )

  const olas = trending.length > 0 && (
    <div className="flex flex-wrap gap-2">
      {trending.map((t) => (
        <a key={t} href={`/tag/${encodeURIComponent(t)}`} onClick={() => setHoja(false)} className="chip"><Hash size={13} weight="bold" />{t}</a>
      ))}
    </div>
  )

  return (
    <>
      {/* ═══ BARRA SUPERIOR ═══ */}
      <header ref={raiz} className="sticky top-0 z-50"
        style={{ background: 'color-mix(in srgb, var(--paper) 88%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--line)' }}>
        <div className="mx-auto max-w-[1400px] h-[64px] md:h-[68px] px-4 sm:px-6 flex items-center gap-3 md:gap-5">
          <a href="/" className="flex items-center gap-2.5 shrink-0" aria-label={t('inicio_aria')}>
            <img src="/logo.webp" alt="" width="34" height="34" style={{ width: 34, height: 34, objectFit: 'contain' }} />
            <span className="text-[19px] font-semibold tracking-[-0.03em]">La Charca</span>
          </a>

          {/* Escritorio: enlaces y megamenús */}
          <nav className="hidden lg:flex items-center gap-1 ml-2" aria-label={t('principal')}>
            {tabs.map((t) => (
              <a key={t.key} href={t.href} aria-current={active === t.key ? 'page' : undefined}
                className={`nav-item rounded-full px-3.5 py-2 text-[15px] ${active === t.key ? 'font-semibold' : 'ink-2'}`}
                style={active === t.key ? { background: 'var(--active)' } : undefined}>{t.label}</a>
            ))}
            {disparador('explorar', t('explorar'), active === 'explore')}
            {viewer && disparador('charca', t('tu_charca'), ['saved', 'me', 'panel'].includes(active))}
            {disparador('capibara', t('capibara'))}
          </nav>

          {/* Buscador (escritorio) */}
          <form onSubmit={buscar} className="hidden md:flex flex-1 max-w-[360px] ml-auto items-center gap-2 rounded-full px-4 h-11 transition-shadow focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--blue)_25%,transparent)]"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <MagnifyingGlass size={18} className="ink-3 shrink-0" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('buscar_placeholder')}
              className="flex-1 min-w-0 bg-transparent text-[15px] focus:outline-none" />
          </form>

          {/* Acciones */}
          <div className="flex items-center gap-1 md:gap-1.5 ml-auto md:ml-0">
            {/* Envueltos: .icon-btn fija su propio display y pisaría hidden/md:hidden. */}
            <span className="md:hidden"><a href="/explorar" className="icon-btn" aria-label={t('buscar')}><MagnifyingGlass size={21} /></a></span>
            {viewer ? (
              <>
                <span className="hidden md:inline-flex"><a href={publicarHref} className="btn !py-2.5 !px-4"><Plus size={16} weight="bold" /> {t('publicar')}</a></span>
                <a href="/mensajes" className="icon-btn" aria-label={t('mensajes')}
                  style={active === 'messages' ? { color: 'var(--blue)', background: 'var(--active)' } : undefined}>
                  <ChatCircleDots size={22} weight={active === 'messages' ? 'fill' : 'regular'} />
                </a>
                <span className="hidden md:inline-flex">
                  <a href="/avisos" className="icon-btn relative" aria-label={t('avisos')}
                    style={active === 'alerts' ? { color: 'var(--blue)', background: 'var(--active)' } : undefined}>
                    <Bell size={22} weight={active === 'alerts' ? 'fill' : 'regular'} />
                    <span className="absolute -top-0.5 -right-0.5"><NotifBadge /></span>
                  </a>
                </span>
                <span className="hidden md:inline-flex"><LanguageSwitcher /></span>
                <div className="hidden md:block ml-1">
                  <IdentitySwitcher user={{ handle: viewer.handle, displayName: viewer.displayName, avatarUrl: viewer.avatarUrl, type: 'user' }} abajo compacto />
                </div>
              </>
            ) : (
              <>
                <span className="hidden md:inline-flex"><LanguageSwitcher /></span>
                <ThemeToggle compact />
                <a href="/auth/login" className="btn !py-2.5 !px-4">{t('entrar')}</a>
              </>
            )}
          </div>
        </div>

        {/* Megamenú (escritorio) */}
        {panel && (
          <div className="hidden lg:block absolute inset-x-0 top-full pt-2" onMouseEnter={() => abrir(panel)} onMouseLeave={cerrarLuego}>
            <div className="mx-auto max-w-[1400px] px-6">
              <div className="rise card overflow-hidden" style={{ boxShadow: '0 24px 60px -20px var(--shadow)' }}>
                {panel === 'explorar' && (
                  <div className="grid grid-cols-12">
                    <div className="col-span-7 p-4">
                      <Eyebrow>{t('descubrir')}</Eyebrow>
                      <div className="grid grid-cols-2 gap-1">{descubrir.map((e) => <Opcion key={e.href} e={e} />)}</div>
                    </div>
                    <div className="col-span-5 p-6" style={{ borderLeft: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                      <p className="eyebrow mb-3 flex items-center gap-1.5"><Sparkle size={13} weight="fill" /> {t('haciendo_olas')}</p>
                      {olas || <p className="t-sub">{t('sin_olas')}</p>}
                      <a href="/explorar" className="btn-ghost !px-0 mt-4">{t('ver_explorar')} <CaretRight size={14} weight="bold" /></a>
                    </div>
                  </div>
                )}
                {panel === 'charca' && viewer && (
                  <div className="grid grid-cols-12">
                    <div className={`${deScan.length ? 'col-span-8' : 'col-span-12'} p-4`}>
                      <Eyebrow>{t('tu_charca')}</Eyebrow>
                      <div className={`grid ${deScan.length ? 'grid-cols-2' : 'grid-cols-3'} gap-1`}>{tuCharca.map((e) => <Opcion key={e.href} e={e} />)}</div>
                    </div>
                    {deScan.length > 0 && (
                      <div className="col-span-4 p-4" style={{ borderLeft: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                        <Eyebrow>{t('actuando_como', { handle: scan!.handle })}</Eyebrow>
                        <div className="flex flex-col gap-1">{deScan.map((e) => <Opcion key={e.href} e={e} />)}</div>
                      </div>
                    )}
                  </div>
                )}
                {panel === 'capibara' && (
                  <div className="grid grid-cols-12">
                    <div className="col-span-8 p-4">
                      <Eyebrow>{capi.marca}</Eyebrow>
                      <div className="grid grid-cols-2 gap-1">{capibara.map((e) => <Opcion key={e.href} e={e} />)}</div>
                    </div>
                    <a href={capi.url} target="_blank" rel="noopener noreferrer" className="col-span-4 m-3 rounded-2xl p-6 flex flex-col justify-between"
                      style={{ background: 'linear-gradient(135deg, var(--blue), var(--aqua))', color: '#fff' }}>
                      <span>
                        <span className="block text-[22px] font-semibold tracking-[-0.03em] leading-tight">{t('promo_titulo')}</span>
                        <span className="block text-[14px] opacity-90 mt-2 leading-snug">{t('promo_texto', { marca: capi.marca })}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-[14px] font-semibold mt-6">{t('ir_a_leer')} <ArrowSquareOut size={15} weight="bold" /></span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ═══ BARRA INFERIOR (móvil) ═══ */}
      <nav aria-label={t('navegacion')} className="md:hidden fixed bottom-0 inset-x-0 z-50"
        style={{ background: 'color-mix(in srgb, var(--paper) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: '1px solid var(--line)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch justify-around px-1">
          {[
            { href: '/', label: t('inicio'), key: 'home', Icon: House },
            { href: '/explorar', label: t('explorar'), key: 'explore', Icon: Compass },
          ].map(({ key, ...t }) => <Pestana key={key} {...t} on={active === key} />)}
          <div className="flex flex-1 items-start justify-center">
            <a href={publicarHref} aria-label={t('publicar')}
              className="-mt-4 grid place-items-center rounded-2xl active:scale-95 transition-transform"
              style={{ color: '#fff', width: 54, height: 54, background: 'linear-gradient(135deg, var(--blue), var(--aqua))', boxShadow: '0 10px 26px -8px color-mix(in srgb, var(--blue) 70%, transparent), 0 0 0 4px var(--paper)' }}>
              <Plus size={24} weight="bold" />
            </a>
          </div>
          {viewer
            ? <Pestana href="/avisos" label={t('avisos')} Icon={Bell} on={active === 'alerts'} badge />
            : <Pestana href="/scans" label={t('scans')} Icon={Storefront} on={active === 'scans'} />}
          <button type="button" onClick={() => setHoja(true)} aria-label={t('menu')}
            className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[58px] ink-3 active:scale-95 transition-transform">
            {viewer ? <Avatar v={viewer} size={24} /> : <List size={24} />}
            <span className="text-[10px] font-medium leading-none">{t('menu')}</span>
          </button>
        </div>
      </nav>

      {/* ═══ MENÚ COMPLETO (móvil) ═══ */}
      {hoja && (
        <div className="md:hidden fixed inset-0 z-[80] flex items-end" role="dialog" aria-modal="true" aria-label={t('menu')}>
          <div className="absolute inset-0" style={{ background: 'var(--scrim)', backdropFilter: 'blur(3px)' }} onClick={() => setHoja(false)} />
          <div className="relative w-full max-h-[92vh] overflow-y-auto overscroll-contain rounded-t-[28px] rise"
            style={{ background: 'var(--paper)', borderTop: '1px solid var(--line)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <div className="sticky top-0 z-10 px-4 pt-2.5 pb-3" style={{ background: 'color-mix(in srgb, var(--paper) 92%, transparent)', backdropFilter: 'blur(14px)' }}>
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full" style={{ background: 'var(--line)' }} />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <img src="/logo.webp" alt="" width="28" height="28" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                  <span className="text-[17px] font-semibold tracking-[-0.03em]">La Charca</span>
                </span>
                <button type="button" onClick={() => setHoja(false)} className="icon-btn" aria-label={t('cerrar_menu')}
                  style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}><X size={18} /></button>
              </div>
              <form onSubmit={buscar} className="mt-3 flex items-center gap-2 rounded-2xl px-3.5" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <MagnifyingGlass size={18} className="ink-3 shrink-0" />
                <input type="search" enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('buscar_placeholder')}
                  className="w-full bg-transparent py-3 text-[16px] focus:outline-none" />
              </form>
            </div>

            <div className="px-4">
              {viewer ? (
                <div className="card p-3">
                  <IdentitySwitcher user={{ handle: viewer.handle, displayName: viewer.displayName, avatarUrl: viewer.avatarUrl, type: 'user' }} abajo />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <a href="/auth/login" className="btn justify-center"><SignIn size={17} /> {t('entrar')}</a>
                  <a href="/auth/registro" className="btn-ghost justify-center card"><UserPlus size={17} /> {t('crear_cuenta')}</a>
                </div>
              )}
            </div>

            {viewer && (
              <SeccionMovil titulo={t('tu_charca')}>
                <div className="grid grid-cols-2 gap-2">{tuCharca.map((e) => <TarjetaMovil key={e.href} e={e} onClick={() => setHoja(false)} />)}</div>
              </SeccionMovil>
            )}

            {deScan.length > 0 && (
              <SeccionMovil titulo={t('actuando_como', { handle: scan!.handle })}>
                <div className="grid grid-cols-2 gap-2">{deScan.map((e) => <TarjetaMovil key={e.href} e={e} onClick={() => setHoja(false)} />)}</div>
              </SeccionMovil>
            )}

            <SeccionMovil titulo={t('descubrir')}>
              <div className="grid grid-cols-2 gap-2">{descubrir.map((e) => <TarjetaMovil key={e.href} e={e} onClick={() => setHoja(false)} />)}</div>
            </SeccionMovil>

            {olas && <SeccionMovil titulo={t('haciendo_olas')}>{olas}</SeccionMovil>}

            <SeccionMovil titulo={capi.marca}>
              <div className="grid grid-cols-2 gap-2">{capibara.map((e) => <TarjetaMovil key={e.href} e={e} />)}</div>
            </SeccionMovil>

            <div className="px-4 mt-6">
              <div className="card flex items-center gap-2 pl-3 pr-1.5 py-1.5">
                <span className="t-caption flex-1">{t('idioma')}</span>
                <LanguageSwitcher variante="pastillas" />
              </div>
            </div>

            <div className="px-4 mt-2 flex items-center gap-2">
              <div className="card flex items-center gap-2 pl-3 pr-1 py-1 flex-1">
                <span className="t-caption flex-1">{t('tema')}</span>
                <ThemeToggle compact />
              </div>
              {viewer && (
                <a href="/auth/logout" className="card flex items-center justify-center gap-2 px-4 min-h-[50px] t-caption">
                  <SignOut size={16} /> {t('cerrar_sesion')}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const Pestana = ({ href, label, Icon, on, badge }: { href: string; label: string; Icon: any; on: boolean; badge?: boolean }) => (
  <a href={href} aria-current={on ? 'page' : undefined}
    className={`relative flex-1 flex flex-col items-center justify-center gap-1 min-h-[58px] active:scale-95 transition-transform ${on ? '' : 'ink-3'}`}
    style={on ? { color: 'var(--blue)' } : undefined}>
    <span className="relative grid place-items-center rounded-full" style={{ width: 48, height: 28, background: on ? 'var(--active)' : 'transparent' }}>
      <Icon size={22} weight={on ? 'fill' : 'regular'} />
      {badge && <span className="absolute -top-1 right-0.5"><NotifBadge /></span>}
    </span>
    <span className="text-[10px] font-medium leading-none">{label}</span>
  </a>
)

const SeccionMovil = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <section className="px-4 mt-6">
    <p className="eyebrow mb-2.5 px-1 truncate">{titulo}</p>
    {children}
  </section>
)

const TarjetaMovil = ({ e, onClick }: { e: Enlace; onClick?: () => void }) => (
  <a href={e.href} target={e.external ? '_blank' : undefined} rel={e.external ? 'noopener noreferrer' : undefined} onClick={onClick}
    className="card flex items-start gap-2.5 p-3 active:scale-[0.98] transition-transform">
    <span className="grid place-items-center shrink-0 rounded-xl" style={{ width: 34, height: 34, background: 'var(--soft)', color: 'var(--blue)' }}>
      <e.Icon size={18} weight="duotone" />
    </span>
    <span className="min-w-0">
      <span className="block text-[14px] font-semibold leading-tight">{e.label}</span>
      {e.desc && <span className="block t-caption leading-snug mt-0.5 line-clamp-2" style={{ fontSize: 12 }}>{e.desc}</span>}
    </span>
  </a>
)

export default CharcaNav
