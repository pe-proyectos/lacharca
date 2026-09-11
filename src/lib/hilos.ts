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
export { timeAgo } from './time'
