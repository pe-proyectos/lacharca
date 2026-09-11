// Cliente de navegador para hilos.rest (patron BFF):
// el page token vive SOLO en memoria y se renueva contra lacharca.com/api.
const API = '/api'
let token: string | null = null
let expMs = 0
let inflight: Promise<string | null> | null = null
let base = 'https://hilos.rest'

async function fetchToken(): Promise<string | null> {
  const res = await fetch(`${API}/auth/token`, { method: 'POST', credentials: 'include' })
  const json: any = await res.json().catch(() => ({}))
  if (!json?.status || !json?.data?.token) return null
  token = json.data.token
  expMs = Date.now() + Math.max(30, (json.data.expiresIn || 900) - 60) * 1000 // margen de 60s
  if (json.data.hilosBase) base = json.data.hilosBase
  return token
}

async function getToken(): Promise<string | null> {
  if (token && Date.now() < expMs) return token
  if (!inflight) inflight = fetchToken().finally(() => { inflight = null })
  return inflight
}

export function clearToken() { token = null; expMs = 0 }

// Llama a hilos.rest con el page token; reintenta una vez si expiró.
export async function hilosFetch(path: string, init: RequestInit = {}, retry = true): Promise<any> {
  const t = await getToken()
  if (!t) throw new Error('unauthenticated')
  const res = await fetch(`${base}/v1${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${t}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
  })
  const json: any = await res.json().catch(() => ({}))
  if (json?.error === 'unauthorized' && retry) { clearToken(); return hilosFetch(path, init, false) }
  if (json?.error) throw new Error(json.error)
  return json?.data
}

export const hilosApi = {
  createPost: (content: string) => hilosFetch('/posts', { method: 'POST', body: JSON.stringify({ content }) }),
  like: (id: number) => hilosFetch(`/posts/${id}/like`, { method: 'POST' }),
  comments: (id: number) => hilosFetch(`/posts/${id}/comments`),
  comment: (id: number, content: string) => hilosFetch(`/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
}
