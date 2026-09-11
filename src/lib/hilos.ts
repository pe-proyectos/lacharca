// Cliente server-side de hilos.rest (usa la secret key; solo en SSR).
const BASE = process.env.HILOS_BASE || import.meta.env.HILOS_BASE || 'https://hilos-api.sotf-mods.com'
const SECRET = process.env.HILOS_SECRET_KEY || import.meta.env.HILOS_SECRET_KEY || ''
export async function hilos(path: string, actingPage?: string | null) {
  const headers: Record<string, string> = { Authorization: `Bearer ${SECRET}` }
  if (actingPage) headers['X-Hilos-Page'] = actingPage
  const res = await fetch(`${BASE}/v1${path}`, { headers })
  const json = await res.json().catch(() => ({}))
  return json?.data
}
export function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'ahora'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`
  const h = Math.floor(s / 3600); if (h < 24) return `${h}h`
  return `${Math.floor(s / 86400)}d`
}
