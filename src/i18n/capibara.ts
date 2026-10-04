// CapibaraTraductor en cada idioma: a dónde mandar a leer (y a iniciar sesión
// por SSO, pages/auth/login.astro) según el idioma de la interfaz.
import { idiomaUi, type Idioma } from './index'

export interface SitioCapibara { url: string; marca: string; discord: string }

export const CAPIBARA: Record<Idioma, SitioCapibara> = {
  es: { url: 'https://capibaratraductor.com', marca: 'CapibaraTraductor', discord: 'https://discord.gg/xJqCWAUxVt' },
  en: { url: 'https://capybaratranslator.com', marca: 'CapybaraTranslator', discord: 'https://discord.gg/Ph7sWqNGJW' },
  pt: { url: 'https://capivaratradutor.com', marca: 'CapivaraTradutor', discord: 'https://discord.gg/qpmAcHEvNM' },
}

/** Sitio de Capibara del idioma de la interfaz. */
export const capibara = (): SitioCapibara => CAPIBARA[idiomaUi()]
