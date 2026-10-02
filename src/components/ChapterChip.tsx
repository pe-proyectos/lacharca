import React from 'react'
import { BookOpenText, ArrowUpRight } from '@phosphor-icons/react'
import { urlCapitulo, etiquetaCapitulo, type PostChapter } from '../lib/capitulo'

// "Cap. 12" pequeño que lleva al capítulo en CapibaraTraductor. Sin datos del
// capítulo no pinta nada. `work` añade el nombre de la obra cuando no está a la
// vista. `inLink`: dentro de otro enlace (avisos) no se puede anidar un <a>.
const ChapterChip: React.FC<{ chapter?: PostChapter | null; work?: string | null; inLink?: boolean; className?: string }> = ({ chapter, work, inLink = false, className = '' }) => {
  const href = urlCapitulo(chapter)
  if (!chapter || !href) return null
  const label = etiquetaCapitulo(chapter)
  const title = `Leer ${chapter.number ? `el capítulo ${chapter.number}` : 'el capítulo'}${work ? ` de ${work}` : ''} en CapibaraTraductor`
  const inner = (
    <>
      <BookOpenText size={13} weight="bold" className="shrink-0" aria-hidden />
      <span className="shrink-0">{label}</span>
      {work && <span className="cap-chip__work">· {work}</span>}
      <ArrowUpRight size={10} weight="bold" className="shrink-0 cap-chip__go" aria-hidden />
    </>
  )
  if (inLink) {
    const abrir = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); window.open(href, '_blank', 'noopener') }
    return (
      <span role="link" tabIndex={0} title={title} aria-label={title} className={`cap-chip ${className}`}
        onClick={abrir} onKeyDown={(e) => { if (e.key === 'Enter') abrir(e) }}>
        {inner}
      </span>
    )
  }
  return (
    <a href={href} target="_blank" rel="noopener" title={title} aria-label={title} className={`cap-chip ${className}`}>
      {inner}
    </a>
  )
}
export default ChapterChip
