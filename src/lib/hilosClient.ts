// Cliente de navegador para hilos.rest (patron BFF):
// el page token vive SOLO en memoria y se renueva contra lacharca.com/api.
const API = '/api'
let token: string | null = null
let expMs = 0
let inflight: Promise<string | null> | null = null
let base = 'https://hilos.rest'
// Con qué identidad se actúa: null es tu propia cuenta, un handle es un scan
// del que formas parte. Vive en el navegador porque es una preferencia de uso.
let identidad: string | null = null

export function getIdentity(): string | null {
  if (identidad === null && typeof localStorage !== 'undefined') {
    identidad = localStorage.getItem('lc-identity') || null
  }
  return identidad
}

export interface IdentityPage { handle: string; displayName?: string | null; avatarUrl?: string | null; type?: string }

export function getIdentityPage(): IdentityPage | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem('lc-identity-page')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function setIdentity(handle: string | null, page?: IdentityPage) {
  identidad = handle
  try {
    if (handle) {
      localStorage.setItem('lc-identity', handle)
      if (page) localStorage.setItem('lc-identity-page', JSON.stringify(page))
    } else {
      localStorage.removeItem('lc-identity')
      localStorage.removeItem('lc-identity-page')
    }
  } catch {}
  clearToken() // el token viejo era de la identidad anterior
  window.dispatchEvent(new CustomEvent('lc:identity', { detail: { handle, page } }))
}

async function fetchToken(): Promise<string | null> {
  const como = getIdentity()
  const res = await fetch(`${API}/auth/token`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(como ? { as: como } : {}),
  })
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

// Sube un archivo y devuelve su URL pública. Va a través del motor: el bucket
// no acepta PUT desde el navegador, y así tampoco expone URLs firmadas.
export async function uploadToHilos(file: File): Promise<string> {
  const t = await getToken()
  if (!t) throw new Error('unauthenticated')

  const form = new FormData()
  form.append('file', file, file.name)

  const res = await fetch(`${base}/v1/uploads/direct`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}` },
    body: form,
  })
  const json: any = await res.json().catch(() => ({}))
  if (json?.error || !json?.data?.publicUrl) throw new Error(json?.error || 'upload_failed')
  return json.data.publicUrl
}

export const hilosApi = {
  createPost: (content: string, extra: Record<string, any> = {}) =>
    hilosFetch('/posts', { method: 'POST', body: JSON.stringify({ content, ...extra }) }),
  vote: (postId: number, optionIndex: number) =>
    hilosFetch(`/posts/${postId}/vote`, { method: 'POST', body: JSON.stringify({ optionIndex }) }),
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
  conversations: (page = 0, archived = false) =>
    hilosFetch(`/conversations?page=${page}&limit=30${archived ? '&archived=1' : ''}`),
  archive: (id: number, archived = true) =>
    hilosFetch(`/conversations/${id}/archive`, { method: 'POST', body: JSON.stringify({ archived }) }),
  subpages: (handle: string, page = 0, q = '') =>
    hilosFetch(`/pages/${encodeURIComponent(handle)}/subpages?page=${page}&limit=30${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  buscarPages: (q: string) => hilosFetch(`/pages/directory?q=${encodeURIComponent(q)}&limit=8&type=user`),
  messages: (id: number, page = 0) => hilosFetch(`/conversations/${id}/messages?page=${page}&limit=40`),
  send: (handle: string, content: string) => hilosFetch('/messages', { method: 'POST', body: JSON.stringify({ handle, content }) }),
  unread: () => hilosFetch('/messages/unread'),
  identities: async () => {
    const res = await fetch(`${API}/me/identities`, { credentials: 'include' })
    const json: any = await res.json().catch(() => ({}))
    return json?.status ? json.data : []
  },
  notifications: (page = 0) => hilosFetch(`/notifications?page=${page}&limit=20`),
  notificationsUnread: () => hilosFetch('/notifications/unread'),
  readNotifications: (id?: number) => hilosFetch('/notifications/read', { method: 'POST', body: JSON.stringify(id ? { id } : {}) }),
  feed: (scope: 'foryou' | 'following' = 'foryou', page = 0) => hilosFetch(`/feed?scope=${scope}&page=${page}&limit=25`),
}
