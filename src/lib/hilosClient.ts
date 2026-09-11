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

// Sube un archivo al almacenamiento de hilos (URL prefirmada) y devuelve la
// URL publica. La clave nunca pasa por el navegador.
export async function uploadToHilos(file: File): Promise<string> {
  const pre = await hilosFetch('/uploads', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream' }),
  })
  if (!pre?.uploadUrl) throw new Error('upload_failed')
  const res = await fetch(pre.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } })
  if (!res.ok) throw new Error('upload_failed')
  return pre.publicUrl
}

export const hilosApi = {
  createPost: (content: string) => hilosFetch('/posts', { method: 'POST', body: JSON.stringify({ content }) }),
  like: (id: number) => hilosFetch(`/posts/${id}/like`, { method: 'POST' }),
  comments: (id: number) => hilosFetch(`/posts/${id}/comments`),
  commentsSorted: (id: number, sort: string, page = 0) =>
    hilosFetch(`/posts/${id}/comments?sort=${encodeURIComponent(sort)}&page=${page}&limit=100`),
  comment: (id: number, content: string, parentCommentId?: number) =>
    hilosFetch(`/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ content, ...(parentCommentId ? { parentCommentId } : {}) }) }),
  save: (id: number) => hilosFetch(`/posts/${id}/save`, { method: 'POST' }),
  follow: (handle: string) => hilosFetch(`/pages/${encodeURIComponent(handle)}/follow`, { method: 'POST' }),
  page: (handle: string) => hilosFetch(`/pages/${encodeURIComponent(handle)}`),
  updateProfile: (handle: string, patch: Record<string, any>) =>
    hilosFetch(`/pages/${encodeURIComponent(handle)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  conversations: (page = 0) => hilosFetch(`/conversations?page=${page}&limit=20`),
  messages: (id: number, page = 0) => hilosFetch(`/conversations/${id}/messages?page=${page}&limit=40`),
  send: (handle: string, content: string) => hilosFetch('/messages', { method: 'POST', body: JSON.stringify({ handle, content }) }),
  unread: () => hilosFetch('/messages/unread'),
  notifications: (page = 0) => hilosFetch(`/notifications?page=${page}&limit=20`),
  notificationsUnread: () => hilosFetch('/notifications/unread'),
  readNotifications: (id?: number) => hilosFetch('/notifications/read', { method: 'POST', body: JSON.stringify(id ? { id } : {}) }),
  feed: (scope: 'foryou' | 'following' = 'foryou', page = 0) => hilosFetch(`/feed?scope=${scope}&page=${page}&limit=25`),
}
