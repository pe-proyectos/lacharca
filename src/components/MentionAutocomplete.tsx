import React, { useEffect, useMemo, useRef, useState } from 'react'
import { hilosApi } from '../lib/hilosClient'

interface Page { handle: string; displayName?: string | null; avatarUrl?: string | null; type?: string }

interface Props {
  /** El textarea que se está escribiendo. */
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  value: string
  onPick: (nuevoTexto: string, cursor: number) => void
}

// Escribir "@" no siempre es mencionar: también aparece en correos, en precios
// o simplemente porque sí. Por eso esto solo se ofrece, nunca se impone: si no
// eliges a nadie, tu texto se queda exactamente como lo escribiste.
const MentionAutocomplete: React.FC<Props> = ({ inputRef, value, onPick }) => {
  const [items, setItems] = useState<Page[]>([])
  const [activo, setActivo] = useState(0)
  const [visible, setVisible] = useState(false)
  const consulta = useRef<string>('')

  // Qué se está escribiendo tras la última arroba, si es que aplica.
  const termino = useMemo(() => {
    const el = inputRef.current
    if (!el) return null
    const pos = el.selectionStart ?? value.length
    const antes = value.slice(0, pos)
    // La arroba tiene que abrir palabra: "hola@correo.com" no es una mención.
    const m = antes.match(/(^|[\s(])@([a-zA-Z0-9_]{0,30})$/)
    if (!m) return null
    return { texto: m[2], inicio: pos - m[2].length - 1, fin: pos }
  }, [value, inputRef])

  useEffect(() => {
    if (!termino || termino.texto.length < 1) { setVisible(false); setItems([]); return }
    consulta.current = termino.texto
    const t = setTimeout(async () => {
      try {
        const d = await hilosApi.buscarPages(termino.texto)
        if (consulta.current !== termino.texto) return
        const encontrados = (d?.items || []).slice(0, 6)
        setItems(encontrados)
        setActivo(0)
        setVisible(encontrados.length > 0)
      } catch { setVisible(false) }
    }, 180)
    return () => clearTimeout(t)
  }, [termino?.texto])

  const elegir = (p: Page) => {
    if (!termino) return
    const antes = value.slice(0, termino.inicio)
    const despues = value.slice(termino.fin)
    const nuevo = `${antes}@${p.handle} ${despues}`
    setVisible(false)
    onPick(nuevo, (antes + '@' + p.handle + ' ').length)
  }

  // Teclado: flechas para moverse, Enter o Tab para elegir, Escape para
  // desistir y seguir escribiendo tu arroba en paz.
  useEffect(() => {
    const el = inputRef.current
    if (!el || !visible) return
    const onKey = (e: KeyboardEvent) => {
      if (!visible || !items.length) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((i) => (i + 1) % items.length) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => (i - 1 + items.length) % items.length) }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); elegir(items[activo]) }
      else if (e.key === 'Escape') { e.preventDefault(); setVisible(false) }
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [visible, items, activo, inputRef, value])

  if (!visible || !items.length) return null

  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-40 rounded-2xl overflow-hidden rise"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: '0 12px 32px var(--shadow)', maxWidth: 320 }}>
      <p className="eyebrow px-3 pt-2.5 pb-1.5">Mencionar a alguien · Esc para omitir</p>
      {items.map((p, i) => (
        <button key={p.handle} type="button" onMouseDown={(e) => { e.preventDefault(); elegir(p) }}
          onMouseEnter={() => setActivo(i)}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer"
          style={i === activo ? { background: 'var(--hover)' } : undefined}>
          {p.avatarUrl
            ? <img src={p.avatarUrl} alt="" style={{ width: 28, height: 28 }} className={`object-cover shrink-0 ${p.type === 'user' ? 'rounded-full' : 'rounded-lg'}`} />
            : <span style={{ width: 28, height: 28, background: 'var(--soft)', color: 'var(--blue)' }}
                className={`grid place-items-center shrink-0 text-[12px] font-semibold ${p.type === 'user' ? 'rounded-full' : 'rounded-lg'}`}>
                {(p.displayName || p.handle)[0]?.toUpperCase()}
              </span>}
          <span className="min-w-0">
            <span className="block text-[14px] font-medium truncate">{p.displayName || p.handle}</span>
            <span className="block t-caption truncate">@{p.handle}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
export default MentionAutocomplete
