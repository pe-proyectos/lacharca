// Perfil de un usuario vinculado: que se guarda en la base y que se manda a
// su page de hilos en cada login.
//
// Capibara movio sus imagenes a /v2/...webp y borro los originales, asi que la
// copia del avatar tomada al vincular puede estar rota. Regla:
// - Imagen vacia o de capibaratraductor.com: se pisa con la actual de Capibara.
// - Imagen propia (subida en La Charca, r2.hilos.rest u otra): no se toca.
// - Nombre y bio se editan en La Charca (en la page): solo se rellenan si faltan.
// Todo puro: syncPage y el script de reparacion aplican el plan.

const CAPIBARA = /^https?:\/\/(?:r2|files)\.capibaratraductor\.com\//i

export const esDeCapibara = (url?: string | null) => !!url && CAPIBARA.test(url)
// Vacia o copia de Capibara: se puede reemplazar por la imagen actual.
export const reemplazable = (url?: string | null) => !url || esDeCapibara(url)

export interface PageHilos { id?: number; handle: string; displayName: string | null; avatarUrl: string | null; bannerUrl?: string | null; bio: string | null }
export interface UserCharca { handle: string; displayName: string | null; avatarUrl: string | null; bannerUrl: string | null; bio: string | null }
export interface ExtCapibara { imageUrl?: string | null; bannerUrl?: string | null }

// La propia del usuario (page primero, luego la base) o la actual de Capibara.
function elegir(enPage: string | null | undefined, enBase: string | null | undefined, actual: string | null | undefined) {
  if (!reemplazable(enPage)) return enPage as string
  if (!reemplazable(enBase)) return enBase as string
  return actual || null
}

// Copia en la base antes de tocar hilos: la foto de Capibara siempre fresca.
export function refrescoBase(user: UserCharca, ext: ExtCapibara) {
  const data: Partial<UserCharca> = {}
  if (reemplazable(user.avatarUrl) && (user.avatarUrl || null) !== (ext.imageUrl || null)) data.avatarUrl = ext.imageUrl || null
  if (reemplazable(user.bannerUrl) && (user.bannerUrl || null) !== (ext.bannerUrl || null)) data.bannerUrl = ext.bannerUrl || null
  return data
}

// Plan completo con la page actual (null si aun no existe).
export function planPerfil(user: UserCharca, page: PageHilos | null, ext: ExtCapibara) {
  const avatar = elegir(page?.avatarUrl, user.avatarUrl, ext.imageUrl)
  const banner = elegir(page?.bannerUrl, user.bannerUrl, ext.bannerUrl)
  const displayName = (page?.displayName || user.displayName || user.handle).slice(0, 120)
  const bio = (page?.bio || user.bio || '').slice(0, 600) || null

  // POST /pages (upsert): solo lo que falta o cambia; undefined = no tocar.
  const upsert: { displayName?: string; bio?: string; avatarUrl?: string } = {}
  if (!page?.displayName) upsert.displayName = displayName
  if (!page?.bio && bio) upsert.bio = bio
  if (avatar && avatar !== page?.avatarUrl) upsert.avatarUrl = avatar

  // PATCH: vaciar un avatar roto (el upsert no sabe) y renovar un banner que
  // sea copia de Capibara. Un banner vacio en la page no se rellena.
  const parche: { avatarUrl?: null; bannerUrl?: string | null } = {}
  if (!avatar && page?.avatarUrl) parche.avatarUrl = null
  if (page && esDeCapibara(page.bannerUrl) && banner !== page.bannerUrl) parche.bannerUrl = banner

  // La base refleja lo decidido (la page manda en nombre y bio).
  const base: Partial<UserCharca> = {}
  if ((user.avatarUrl || null) !== avatar) base.avatarUrl = avatar
  if ((user.bannerUrl || null) !== banner) base.bannerUrl = banner
  if ((user.displayName || null) !== displayName) base.displayName = displayName
  if ((user.bio || null) !== bio) base.bio = bio

  return { avatar, banner, upsert, parche, base }
}
