// Formato de números y plurales en español, para no escribir "1 seguidores".
export const num = (v: any) => Number(v || 0).toLocaleString('es')

export function plural(count: any, singular: string, plural_: string) {
  const c = Number(count || 0)
  return `${num(c)} ${c === 1 ? singular : plural_}`
}

export const followers = (c: any) => plural(c, 'seguidor', 'seguidores')
export const posts = (c: any) => plural(c, 'publicación', 'publicaciones')
export const replies = (c: any) => plural(c, 'respuesta', 'respuestas')
