import React, { useEffect, useRef, useState } from 'react'
import { Check, Translate } from '@phosphor-icons/react'
import { IDIOMAS, NOMBRE_IDIOMA, cambiarIdioma, useT, type Idioma } from '../i18n'
import cat from '../i18n/catalogos/idioma'

// Selector de idioma. La elección se guarda en la cookie `lc_lang` (un año) y
// la página se vuelve a pintar en ese idioma.
// `menu`: botón con icono y desplegable (barra superior).
// `pastillas`: ES · EN · PT en línea (menú móvil, menú de cuenta).
const LanguageSwitcher: React.FC<{ variante?: 'menu' | 'pastillas' }> = ({ variante = 'menu' }) => {
  const t = useT(cat)
  const actual = t.idioma
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abierto])

  const elegir = (i: Idioma) => { setAbierto(false); if (i !== actual) cambiarIdioma(i) }

  if (variante === 'pastillas') {
    return (
      <div role="radiogroup" aria-label={t('idioma')} className="flex items-center gap-1 rounded-full p-1"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
        {IDIOMAS.map((i) => (
          <button key={i} type="button" role="radio" aria-checked={i === actual} lang={i} title={NOMBRE_IDIOMA[i]}
            onClick={() => elegir(i)}
            className={`rounded-full px-3 py-1.5 text-[13px] uppercase tracking-wide cursor-pointer transition-colors ${i === actual ? 'font-semibold' : 'ink-3'}`}
            style={i === actual ? { background: 'var(--active)', color: 'var(--blue)' } : undefined}>
            {i}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div ref={caja} className="relative">
      <button type="button" onClick={() => setAbierto(!abierto)} aria-haspopup="menu" aria-expanded={abierto}
        title={t('actual', { nombre: NOMBRE_IDIOMA[actual] })} aria-label={t('cambiar')}
        className="icon-btn shrink-0 !inline-flex items-center gap-1 !w-auto px-2.5">
        <Translate size={20} />
        <span className="text-[12px] font-semibold uppercase tracking-wide">{actual}</span>
      </button>
      {abierto && (
        <div role="menu" className="rise card absolute right-0 top-full mt-2 z-[60] min-w-[190px] overflow-hidden p-1.5"
          style={{ boxShadow: '0 18px 44px -16px var(--shadow)' }}>
          {IDIOMAS.map((i) => (
            <button key={i} type="button" role="menuitemradio" aria-checked={i === actual} lang={i} onClick={() => elegir(i)}
              className="nav-item w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[14px] text-left cursor-pointer">
              <span className={i === actual ? 'font-semibold' : ''}>{NOMBRE_IDIOMA[i]}</span>
              {i === actual && <Check size={15} weight="bold" style={{ color: 'var(--blue)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
export default LanguageSwitcher
