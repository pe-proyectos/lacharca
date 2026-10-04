// Tiempo relativo corto ("ahora", 5m, 3h, 2d) en el idioma de la interfaz.
// Vive fuera de lib/hilos.ts para que el bundle del navegador nunca arrastre
// el cliente server-side (que lleva la secret key).
import { idiomaUi } from '../i18n'

const AHORA = { es: 'ahora', en: 'now', pt: 'agora' }

export function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return AHORA[idiomaUi()]
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`
  const h = Math.floor(s / 3600); if (h < 24) return `${h}h`
  return `${Math.floor(s / 86400)}d`
}
