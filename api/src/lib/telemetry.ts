// Telemetria propia de La Charca.
//
// Objetivo doble: saber cuanta gente real usa la pagina y cuantos hay dentro
// ahora mismo. Dos decisiones que condicionan todo lo demas:
//
// 1. El pulso lo manda JavaScript desde el navegador, no el servidor al servir
//    el HTML. Los rastreadores que solo piden HTML no ejecutan nada, asi que
//    quedan fuera sin tener que adivinar por el user-agent.
// 2. Al visitante no se le deja nada en el navegador. Se le identifica con un
//    hash de (sal secreta + dia + ip + user-agent), que cambia solo cada 24h.
//    Sirve para contar personas distintas en un dia, no para seguir a nadie.

import { createHash } from 'crypto'

const SALT = process.env.TELEMETRY_SALT || process.env.SSO_SECRET || 'lacharca'

// Rastreadores declarados. El filtro de verdad es que esto corre en JS, pero
// algunos bots si ejecutan scripts y conviene descontarlos.
const BOT = /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|discordbot|preview|headless|lighthouse|pagespeed|gtmetrix|uptime|pingdom|curl|wget|python-requests|axios|node-fetch|go-http/i

export function esBot(ua: string): boolean {
  return !ua || ua.length < 20 || BOT.test(ua)
}

export function ipCliente(request: Request): string {
  const h = request.headers
  const fwd = h.get('x-forwarded-for')
  // El primer salto es el cliente; el resto son proxies.
  if (fwd) return fwd.split(',')[0].trim()
  return h.get('cf-connecting-ip') || h.get('x-real-ip') || '0.0.0.0'
}

export function pais(request: Request): string | null {
  const c = request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country')
  return c && /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : null
}

export function dispositivo(ua: string): string {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return 'tablet'
  if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)) return 'movil'
  return 'escritorio'
}

// Identificador diario del visitante. No se guarda la ip ni el user-agent.
export function idVisitante(request: Request, ua: string): string {
  const dia = new Date().toISOString().slice(0, 10)
  return createHash('sha256').update(`${SALT}|${dia}|${ipCliente(request)}|${ua}`).digest('hex').slice(0, 32)
}

// Deja solo el dominio de quien nos enlaza, y descarta el trafico interno.
export function origenExterno(ref: string | null | undefined, propio: string): string | null {
  if (!ref) return null
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '')
    return host === propio || host.endsWith(`.${propio}`) ? null : host.slice(0, 120)
  } catch { return null }
}

// Normaliza la ruta para que los perfiles no generen miles de filas distintas.
export function rutaNormalizada(p: string): string {
  const limpia = (p || '/').split('?')[0].split('#')[0].slice(0, 300)
  if (/^\/@[^/]+\/[^/]+$/.test(limpia)) return '/@perfil/obra'
  if (/^\/@[^/]+$/.test(limpia)) return '/@perfil'
  if (/^\/post\/\d+$/.test(limpia)) return '/post/:id'
  if (/^\/mensajes\/.+$/.test(limpia)) return '/mensajes/:handle'
  if (/^\/tag\/.+$/.test(limpia)) return '/tag/:tag'
  return limpia
}
