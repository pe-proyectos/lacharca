import React, { useCallback, useEffect, useRef, useState } from 'react'
import { X, MagnifyingGlassPlus, MagnifyingGlassMinus, DownloadSimple, ArrowsOut, CaretLeft, CaretRight } from '@phosphor-icons/react'

const MIN = 1
const MAX = 6
const STEP = 0.5

// Visor de imágenes a pantalla completa: zoom, arrastre y descarga. Se abre
// desde cualquier imagen marcada con data-lightbox, en SSR o en React.
const Lightbox: React.FC = () => {
  const [list, setList] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [loading, setLoading] = useState(true)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const open = list.length > 0
  const src = list[index]

  const reset = useCallback(() => { setScale(1); setOffset({ x: 0, y: 0 }) }, [])
  const close = useCallback(() => { setList([]); reset() }, [reset])

  const go = useCallback((delta: number) => {
    setIndex((i) => {
      const n = (i + delta + list.length) % list.length
      return n
    })
    reset(); setLoading(true)
  }, [list.length, reset])

  // Apertura por delegación: cualquier imagen con data-lightbox entra aquí.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const img = (e.target as HTMLElement)?.closest?.('[data-lightbox]') as HTMLElement | null
      if (!img) return
      e.preventDefault()
      const group = img.getAttribute('data-lightbox-group')
      const srcs = group
        ? [...document.querySelectorAll(`[data-lightbox-group="${group}"]`)].map((el) => el.getAttribute('data-src') || (el as HTMLImageElement).src)
        : [img.getAttribute('data-src') || (img as HTMLImageElement).src]
      const current = img.getAttribute('data-src') || (img as HTMLImageElement).src
      setList(srcs)
      setIndex(Math.max(0, srcs.indexOf(current)))
      setLoading(true)
      reset()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [reset])

  // Teclado: cerrar, navegar y hacer zoom sin tocar el ratón.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight' && list.length > 1) go(1)
      else if (e.key === 'ArrowLeft' && list.length > 1) go(-1)
      else if (e.key === '+' || e.key === '=') setScale((s) => Math.min(MAX, s + STEP))
      else if (e.key === '-') setScale((s) => Math.max(MIN, s - STEP))
      else if (e.key === '0') reset()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, close, go, list.length, reset])

  if (!open) return null

  const zoomAt = (delta: number) => setScale((s) => {
    const next = Math.min(MAX, Math.max(MIN, s + delta))
    if (next === 1) setOffset({ x: 0, y: 0 })
    return next
  })

  const download = async () => {
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = src.split('/').pop()?.split('?')[0] || 'imagen'
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    } catch { window.open(src, '_blank') }
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col" style={{ background: 'rgba(9,14,25,.94)' }}
      onClick={(e) => { if (e.target === e.currentTarget) close() }}>

      <header className="flex items-center justify-between gap-2 px-4 py-3 shrink-0" style={{ color: '#fff' }}>
        <span className="text-[13px] tabular-nums" style={{ color: 'rgba(255,255,255,.6)' }}>
          {list.length > 1 ? `${index + 1} / ${list.length}` : ''}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => zoomAt(-STEP)} disabled={scale <= MIN} aria-label="Alejar" title="Alejar (-)"
            className="lb-btn"><MagnifyingGlassMinus size={19} /></button>
          <span className="text-[13px] tabular-nums w-12 text-center" style={{ color: 'rgba(255,255,255,.7)' }}>{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => zoomAt(STEP)} disabled={scale >= MAX} aria-label="Acercar" title="Acercar (+)"
            className="lb-btn"><MagnifyingGlassPlus size={19} /></button>
          <button type="button" onClick={reset} aria-label="Ajustar" title="Ajustar (0)" className="lb-btn"><ArrowsOut size={19} /></button>
          <button type="button" onClick={download} aria-label="Descargar" title="Descargar" className="lb-btn"><DownloadSimple size={19} /></button>
          <button type="button" onClick={close} aria-label="Cerrar" title="Cerrar (Esc)" className="lb-btn"><X size={19} /></button>
        </div>
      </header>

      <div
        className="flex-1 min-h-0 relative overflow-hidden"
        onWheel={(e) => { if (e.ctrlKey || e.metaKey || scale > 1) { e.preventDefault(); zoomAt(e.deltaY > 0 ? -0.25 : 0.25) } }}
        onDoubleClick={() => (scale > 1 ? reset() : setScale(2))}
        onMouseDown={(e) => { if (scale > 1) drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y } }}
        onMouseMove={(e) => {
          if (!drag.current) return
          setOffset({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) })
        }}
        onMouseUp={() => { drag.current = null }}
        onMouseLeave={() => { drag.current = null }}
        onClick={(e) => { if (e.target === e.currentTarget) close() }}
        style={{ cursor: scale > 1 ? (drag.current ? 'grabbing' : 'grab') : 'zoom-in' }}>

        {loading && <span className="absolute inset-0 grid place-items-center text-[13px]" style={{ color: 'rgba(255,255,255,.5)' }}>Cargando…</span>}

        <img
          src={src}
          alt=""
          onLoad={() => setLoading(false)}
          draggable={false}
          className="absolute left-1/2 top-1/2 select-none"
          style={{
            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: drag.current ? 'none' : 'transform .18s ease-out',
            maxWidth: '94vw',
            maxHeight: 'calc(100dvh - 120px)',
            opacity: loading ? 0 : 1,
          }}
        />

        {list.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Anterior"
              className="lb-nav" style={{ left: 12 }}><CaretLeft size={22} /></button>
            <button type="button" onClick={() => go(1)} aria-label="Siguiente"
              className="lb-nav" style={{ right: 12 }}><CaretRight size={22} /></button>
          </>
        )}
      </div>

      <footer className="shrink-0 px-4 py-3 text-center">
        <a href={src} target="_blank" rel="noopener" className="text-[12px]" style={{ color: 'rgba(255,255,255,.45)' }}>
          Abrir original en una pestaña nueva
        </a>
      </footer>
    </div>
  )
}
export default Lightbox
