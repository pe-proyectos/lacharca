// Números y plurales en el idioma de la interfaz, para no escribir "1 seguidores".
import { idiomaUi, locUi, type Idioma } from '../i18n'

export const num = (v: any) => Number(v || 0).toLocaleString(locUi())

export function plural(count: any, singular: string, plural_: string) {
  const c = Number(count || 0)
  return `${num(c)} ${c === 1 ? singular : plural_}`
}

type Formas = Record<Idioma, [string, string]>
const contador = (formas: Formas) => (c: any) => plural(c, ...formas[idiomaUi()])

export const followers = contador({ es: ['seguidor', 'seguidores'], en: ['follower', 'followers'], pt: ['seguidor', 'seguidores'] })
export const posts = contador({ es: ['publicación', 'publicaciones'], en: ['post', 'posts'], pt: ['publicação', 'publicações'] })
export const replies = contador({ es: ['respuesta', 'respuestas'], en: ['reply', 'replies'], pt: ['resposta', 'respostas'] })
