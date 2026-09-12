import React, { useEffect, useState } from 'react'
import { Sun, Moon, Desktop } from '@phosphor-icons/react'

type Theme = 'light' | 'dark' | 'system'

const ORDEN: Theme[] = ['light', 'dark', 'system']
const ICONO = { light: Sun, dark: Moon, system: Desktop }
const NOMBRE = { light: 'Claro', dark: 'Oscuro', system: 'Automático' }

// Interruptor de tema. Recorre claro → oscuro → automático; "automático" sigue
// la preferencia del sistema operativo.
const ThemeToggle: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    setTheme(((localStorage.getItem('lc-theme') as Theme) || 'system'))
  }, [])

  const apply = (next: Theme) => {
    setTheme(next)
    localStorage.setItem('lc-theme', next)
    const dark = next === 'dark' || (next === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }

  // En modo automático hay que reaccionar si el sistema cambia de tema.
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => { document.documentElement.dataset.theme = mq.matches ? 'dark' : 'light' }
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [theme])

  const Icon = ICONO[theme]
  const next = ORDEN[(ORDEN.indexOf(theme) + 1) % ORDEN.length]

  return (
    <button
      type="button"
      onClick={() => apply(next)}
      title={`Tema: ${NOMBRE[theme]}. Cambiar a ${NOMBRE[next].toLowerCase()}`}
      aria-label={`Tema ${NOMBRE[theme]}, cambiar a ${NOMBRE[next].toLowerCase()}`}
      className={compact ? 'icon-btn shrink-0' : 'nav-item flex items-center gap-4 px-3 py-2.5 rounded-xl ink-2 w-full cursor-pointer'}
    >
      <Icon size={compact ? 20 : 24} weight={theme === 'system' ? 'regular' : 'fill'} className="shrink-0" />
      {!compact && <span className="hidden xl:block text-[16px]">{NOMBRE[theme]}</span>}
    </button>
  )
}
export default ThemeToggle
