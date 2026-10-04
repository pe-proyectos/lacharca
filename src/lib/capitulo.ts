// Capítulo de CapibaraTraductor al que se refiere un post de hilos (y, con él,
// sus comentarios). Lo calcula hilos en `post.chapter`: los avisos nuevos traen
// la URL del lector; los de antes solo su referencia 'chapter:<id>', y para esos
// CapibaraTraductor resuelve el enlace (sitio del idioma, +18, novelas).

import { useT } from '../i18n'
import cat from '../i18n/catalogos/posts'

export interface PostChapter {
  ref?: string | null
  id?: number | null
  number?: string | null
  url?: string | null
  work?: { handle: string; displayName?: string | null; parentHandle?: string | null } | null
}

const CAPI_API = 'https://capibaratraductor.com/api'

export function urlCapitulo(c: PostChapter | null | undefined): string | null {
  if (!c) return null
  if (c.url && /^https:\/\//.test(c.url)) return c.url
  if (c.ref && /^chapter:\d+$/.test(c.ref)) return `${CAPI_API}/hilos/chapter-go?ref=${encodeURIComponent(c.ref)}`
  return null
}

export function etiquetaCapitulo(c: PostChapter): string {
  const t = useT(cat)
  return c.number ? t('cap_n', { n: c.number }) : t('capitulo')
}
