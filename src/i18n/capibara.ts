// CapibaraTraductor en cada idioma: a dónde mandar a leer según el idioma de
// la interfaz. El inicio de sesión (SSO) siempre va a capibaratraductor.com,
// que es donde viven las cuentas (lib/session.ts → CAPI).
import { idiomaUi, type Idioma } from './index'

export interface SitioCapibara { url: string; marca: string; discord: string }

export const CAPIBARA: Record<Idioma, SitioCapibara> = {
  es: { url: 'https://capibaratraductor.com', marca: 'CapibaraTraductor', discord: 'https://discord.gg/xJqCWAUxVt' },
  en: { url: 'https://capybaratranslator.com', marca: 'CapybaraTranslator', discord: 'https://discord.gg/Ph7sWqNGJW' },
  pt: { url: 'https://capivaratradutor.com', marca: 'CapivaraTradutor', discord: 'https://discord.gg/qpmAcHEvNM' },
}

/** Sitio de Capibara del idioma de la interfaz. */
export const capibara = (): SitioCapibara => CAPIBARA[idiomaUi()]
