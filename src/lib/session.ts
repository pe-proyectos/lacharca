// Sesión propia de La Charca (cookie httpOnly) + consulta a su API.
export const API = process.env.LACHARCA_API || import.meta.env.LACHARCA_API || 'https://api.lacharca.com'
export const CAPI = 'https://capibaratraductor.com'

export async function getViewer(token?: string | null) {
  if (!token) return null
  try {
    const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
    const json: any = await res.json().catch(() => ({}))
    return json?.status ? json.data : null
  } catch { return null }
}
