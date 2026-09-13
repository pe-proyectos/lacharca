import React, { useEffect, useState } from 'react'
import { Users, BookOpen, UserCircle } from '@phosphor-icons/react'
import { getIdentity, getIdentityPage, type IdentityPage } from '../lib/hilosClient'

// Accesos de administración del scan con el que estás actuando. Solo existen
// mientras tienes una identidad de scan activa, así que se pintan en el
// navegador: el servidor no sabe cuál elegiste.
const ScanNav: React.FC = () => {
  const [page, setPage] = useState<IdentityPage | null>(null)

  useEffect(() => {
    const leer = () => {
      const handle = getIdentity()
      setPage(handle ? (getIdentityPage() || { handle }) : null)
    }
    leer()
    const on = (e: any) => setPage(e?.detail?.handle ? (e.detail.page || { handle: e.detail.handle }) : null)
    window.addEventListener('lc:identity', on)
    return () => window.removeEventListener('lc:identity', on)
  }, [])

  if (!page) return null

  const items = [
    { href: `/@${page.handle}`, label: 'Perfil del scan', Icon: UserCircle },
    { href: `/@${page.handle}/equipo`, label: 'Equipo', Icon: Users },
    { href: `/@${page.handle}/obras`, label: 'Obras', Icon: BookOpen },
  ]

  return (
    <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
      <p className="eyebrow px-3 mb-2 hidden xl:block truncate">
        {page.displayName || `@${page.handle}`}
      </p>
      <div className="flex flex-col gap-1">
        {items.map(({ href, label, Icon }) => (
          <a key={href} href={href}
            className="nav-item flex items-center gap-4 px-3 py-2.5 rounded-xl ink-2"
            title={label}>
            <Icon size={22} className="shrink-0" />
            <span className="hidden xl:block text-[15px]">{label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
export default ScanNav
