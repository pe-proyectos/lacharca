import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { randomBytes } from 'crypto'
import { prisma } from './lib/prisma'
import { createHilos } from './lib/hilos-sdk'
import { esBot, idVisitante, dispositivo, pais, origenExterno, rutaNormalizada } from './lib/telemetry'

const CAPI_API = process.env.CAPI_API_URL || 'https://capibaratraductor.com'
const SSO_SECRET = process.env.SSO_SECRET || ''
const SESSION_DAYS = 30
const hilos = createHilos({ baseUrl: process.env.HILOS_BASE || 'https://hilos.rest', secretKey: process.env.HILOS_SECRET_KEY || '' })

// Cliente de hilos actuando como la page del usuario de La Charca.
const asUser = (userId: number) => createHilos({
  baseUrl: process.env.HILOS_BASE || 'https://hilos.rest',
  secretKey: process.env.HILOS_SECRET_KEY || '',
  actingPage: `external:lacharca:user:${userId}`,
})

function slugify(s: string) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'capi'
}
async function uniqueHandle(base: string) {
  let h = slugify(base)
  for (let i = 0; i < 40; i++) {
    const ex = await prisma.user.findUnique({ where: { handle: h }, select: { id: true } })
    if (!ex) return h
    h = `${slugify(base)}_${Math.floor(1000 + Math.random() * 9000)}`
  }
  return `${slugify(base)}_${Date.now().toString(36)}`
}
async function suggestHandle(base: string) { return uniqueHandle(base) }

// Token de sesion: header Authorization (SSR) o cookie httpOnly lc_session (navegador).
function sessionToken(request: Request): string | null {
  const h = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (h) return h
  const raw = request.headers.get('cookie') || ''
  const m = raw.match(/(?:^|;\s*)lc_session=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

async function sessionUser(token?: string | null) {
  if (!token) return null
  const s = await prisma.session.findUnique({ where: { token }, include: { user: true } })
  if (!s || s.expiresAt < new Date()) return null
  return s.user
}

// Registros pendientes de confirmar (memoria, 5 min).
const pending = new Map<string, { ext: any; exp: number }>()
function sweepPending() { const now = Date.now(); for (const [k, v] of pending) if (v.exp < now) pending.delete(k) }

function publicUser(u: any) { return { id: u.id, handle: u.handle, displayName: u.displayName, avatarUrl: u.avatarUrl, bio: u.bio } }

// Si el usuario tenia una page migrada (comentarios historicos de
// capibaratraductor), la reclama para conservar su historial.
async function claimMigratedPage(user: any, capibaraUserId: string | number) {
  try {
    const claimed = await hilos.pages.claim({
      fromExternalId: `capibara:user:${capibaraUserId}`,
      toExternalId: `lacharca:user:${user.id}`,
      handle: user.handle,
      displayName: user.displayName || user.handle,
      avatarUrl: user.avatarUrl || undefined,
    })
    if (claimed?.id) {
      await prisma.user.update({ where: { id: user.id }, data: { hilosPageId: claimed.id } })
      return true
    }
  } catch { /* no habia page migrada */ }
  return false
}

async function syncPage(user: any) {
  try {
    const page = await hilos.pages.upsert({
      externalId: `lacharca:user:${user.id}`, handle: user.handle, type: 'user',
      displayName: user.displayName || user.handle, avatarUrl: user.avatarUrl || undefined, bio: user.bio || undefined,
      createdAt: new Date(user.createdAt).toISOString(),
    })
    if (page?.id && page.id !== user.hilosPageId) await prisma.user.update({ where: { id: user.id }, data: { hilosPageId: page.id } })
  } catch { /* la sesion no depende de hilos */ }
}

async function fetchDirectory(qs: URLSearchParams, userId?: number) {
  const headers: Record<string, string> = { Authorization: `Bearer ${process.env.HILOS_SECRET_KEY || ''}` }
  if (userId) headers['X-Hilos-Page'] = `external:lacharca:user:${userId}`
  const res = await fetch(`${process.env.HILOS_BASE || 'https://hilos.rest'}/v1/pages/directory?${qs}`, { headers })
  const json: any = await res.json().catch(() => ({}))
  return json?.data ?? { items: [], hasMore: false }
}


// ---- Telemetria: apoyo ----
const VENTANA_VIVA = 5 * 60_000
const ADMINS = (process.env.TELEMETRY_ADMINS || 'shoko').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

async function esAdmin(request: Request): Promise<boolean> {
  if (process.env.ADMIN_TOKEN && request.headers.get('x-admin-token') === process.env.ADMIN_TOKEN) return true
  const user = await sessionUser(sessionToken(request))
  return !!user && ADMINS.includes(user.handle.toLowerCase())
}

// Tope por visitante: 60 paginas vistas por minuto. Evita que un bucle o un
// script ajeno inflen las cifras.
const golpes = new Map<string, { n: number; hasta: number }>()
function pasaLimite(id: string): boolean {
  const ahora = Date.now()
  const e = golpes.get(id)
  if (!e || e.hasta < ahora) { golpes.set(id, { n: 1, hasta: ahora + 60_000 }); return true }
  if (e.n >= 60) return false
  e.n++
  return true
}

// Mantenimiento: resume el dia anterior, poda presencias muertas y visitas
// viejas. El resumen diario sobrevive a la poda, asi que el historico no se
// pierde aunque el detalle si.
async function mantenimiento() {
  try {
    await prisma.presence.deleteMany({ where: { lastSeen: { lt: new Date(Date.now() - 30 * 60_000) } } })
    for (const [k, v] of golpes) if (v.hasta < Date.now()) golpes.delete(k)

    const filas: any[] = await prisma.$queryRaw`
      SELECT date_trunc('day', "createdAt")::date AS day,
             count(*)::int AS pageviews,
             count(DISTINCT "visitorId")::int AS visitors,
             count(DISTINCT "sessionId")::int AS sessions,
             count(DISTINCT "userId")::int AS "signedIn"
      FROM visit
      WHERE "createdAt" >= now() - interval '3 days' AND "createdAt" < date_trunc('day', now())
      GROUP BY 1`
    for (const f of filas) {
      await prisma.dailyStat.upsert({
        where: { day: f.day },
        create: { day: f.day, pageviews: f.pageviews, visitors: f.visitors, sessions: f.sessions, signedIn: f.signedIn },
        update: { pageviews: f.pageviews, visitors: f.visitors, sessions: f.sessions, signedIn: f.signedIn },
      })
    }
    await prisma.visit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 86400_000) } } })
  } catch (e) { console.error('mantenimiento telemetria', e) }
}
setInterval(mantenimiento, 10 * 60_000)
setTimeout(mantenimiento, 30_000)

const app = new Elysia()
  .use(cors({ origin: true, credentials: true }))
  .get('/health', () => ({ ok: true, service: 'lacharca-api' }))

  // Paso 1: canjea el codigo SSO. Si ya hay cuenta vinculada, abre sesion.
  // Si no, NO crea nada: devuelve datos sugeridos + un ticket para registrar.
  .post('/auth/capibara/callback', async ({ body }: any) => {
    const code = String(body.code || '')
    if (!code) return { status: false, message: 'missing_code' }
    const res = await fetch(`${CAPI_API}/api/sso/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sso-secret': SSO_SECRET },
      body: JSON.stringify({ code }),
    })
    const json: any = await res.json().catch(() => ({}))
    if (!json?.status || !json?.data?.user) return { status: false, message: json?.message || 'exchange_failed' }
    const ext = json.data.user

    const identity = await prisma.linkedIdentity.findUnique({
      where: { provider_externalUserId: { provider: 'capibaratraductor', externalUserId: String(ext.id) } },
      include: { user: true },
    })

    if (identity?.user) {
      const user = identity.user
      await syncPage(user)
      const token = randomBytes(32).toString('hex')
      await prisma.session.create({ data: { userId: user.id, token, expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000) } })
      return { status: true, data: { state: 'signed_in', token, user: publicUser(user) } }
    }

    // Cuenta nueva: ticket temporal (5 min) para confirmar el registro.
    const ticket = randomBytes(24).toString('hex')
    pending.set(ticket, { ext, exp: Date.now() + 5 * 60_000 })
    return {
      status: true,
      data: {
        state: 'needs_signup',
        ticket,
        suggested: {
          handle: await suggestHandle(ext.slug || ext.username || 'capi'),
          displayName: ext.username || ext.slug || 'Capibara',
          avatarUrl: ext.imageUrl || null,
        },
        linkedTo: { provider: 'CapibaraTraductor', username: ext.username, slug: ext.slug },
      },
    }
  }, { body: t.Object({ code: t.String() }) })

  // Paso 2: el usuario confirma y SE CREA su cuenta de La Charca vinculada.
  .post('/auth/signup', async ({ body }: any) => {
    sweepPending()
    const entry = pending.get(String(body.ticket || ''))
    if (!entry || entry.exp < Date.now()) return { status: false, message: 'ticket_expired' }
    const ext = entry.ext
    const wanted = slugify(String(body.handle || ''))
    if (wanted.length < 3) return { status: false, message: 'handle_too_short' }
    const taken = await prisma.user.findUnique({ where: { handle: wanted }, select: { id: true } })
    if (taken) return { status: false, message: 'handle_taken' }

    const already = await prisma.linkedIdentity.findUnique({
      where: { provider_externalUserId: { provider: 'capibaratraductor', externalUserId: String(ext.id) } },
      select: { id: true },
    })
    if (already) return { status: false, message: 'already_linked' }

    const user = await prisma.user.create({
      data: {
        handle: wanted,
        displayName: String(body.displayName || ext.username || wanted).slice(0, 120),
        avatarUrl: ext.imageUrl || null, bannerUrl: ext.bannerUrl || null,
        bio: ext.description || null, email: ext.email || null,
      },
    })
    await prisma.linkedIdentity.create({
      data: { userId: user.id, provider: 'capibaratraductor', externalUserId: String(ext.id), externalHandle: ext.slug || ext.username || null, email: ext.email || null },
    })
    pending.delete(String(body.ticket))
    const inherited = await claimMigratedPage(user, ext.id)
    if (!inherited) await syncPage(user)
    const token = randomBytes(32).toString('hex')
    await prisma.session.create({ data: { userId: user.id, token, expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000) } })
    return { status: true, data: { state: 'signed_in', token, user: publicUser(user) } }
  }, { body: t.Object({ ticket: t.String(), handle: t.String(), displayName: t.Optional(t.String()) }) })

  // Comprueba disponibilidad del @handle (para la pantalla de registro).
  .get('/auth/handle-available', async ({ query }: any) => {
    const h = slugify(String(query.handle || ''))
    if (h.length < 3) return { status: true, data: { available: false, handle: h, reason: 'too_short' } }
    const taken = await prisma.user.findUnique({ where: { handle: h }, select: { id: true } })
    return { status: true, data: { available: !taken, handle: h } }
  })

  // Sesion actual (+ page token de hilos para acciones del cliente).
  .get('/auth/me', async ({ request }: any) => {
    const token = sessionToken(request)
    const user = await sessionUser(token)
    if (!user) return { status: false, message: 'unauthenticated' }
    return { status: true, data: { user: publicUser(user) } }
  })

  // BFF: emite un page token de CORTA VIDA para que el navegador hable directo
  // con hilos.rest. Requiere sesion valida (cookie httpOnly -> Authorization).
  .post('/auth/token', async ({ request, body }: any) => {
    const user = await sessionUser(sessionToken(request))
    if (!user) return { status: false, message: 'unauthenticated' }
    const comoPage = body?.as ? String(body.as).toLowerCase() : null
    try {
      const r = await hilos.pageTokens.create({
        externalId: `lacharca:user:${user.id}`,
        ttl: 900,
        scopes: ['read', 'post:write', 'comment:write', 'react', 'follow'],
        origin: process.env.PUBLIC_ORIGIN || 'https://lacharca.com',
        ...(comoPage ? { onBehalfOf: comoPage } : {}),
      } as any)
      if (!r?.token) return { status: false, message: 'token_failed' }
      return { status: true, data: { token: r.token, expiresIn: r.expiresIn, hilosBase: process.env.HILOS_BASE || 'https://hilos.rest', as: comoPage } }
    } catch (e: any) { return { status: false, message: e?.code || 'token_failed' } }
  })

  .post('/auth/logout', async ({ request }: any) => {
    const token = sessionToken(request)
    if (token) await prisma.session.deleteMany({ where: { token } })
    return { status: true }
  })

  // Admin: borra una cuenta de La Charca (y opcionalmente su Page en hilos).
  // NO toca la cuenta de CapibaraTraductor. Protegido por ADMIN_TOKEN.
  .post('/admin/delete-account', async ({ request, body }: any) => {
    if (!process.env.ADMIN_TOKEN || request.headers.get('x-admin-token') !== process.env.ADMIN_TOKEN) return { status: false, message: 'forbidden' }
    const handle = String(body.handle || '').toLowerCase()
    const user = await prisma.user.findUnique({ where: { handle }, select: { id: true, handle: true } })
    if (!user) return { status: false, message: 'not_found' }
    await prisma.session.deleteMany({ where: { userId: user.id } })
    await prisma.linkedIdentity.deleteMany({ where: { userId: user.id } })
    await prisma.user.delete({ where: { id: user.id } })
    return { status: true, data: { deleted: user.handle, note: 'La cuenta de CapibaraTraductor no fue modificada.' } }
  }, { body: t.Object({ handle: t.String() }) })

  // Directorio paginado de pages (scroll infinito de scans/lectores).
  .get('/pages/directory', async ({ request, query }: any) => {
    const user = await sessionUser(sessionToken(request))
    const qs = new URLSearchParams()
    qs.set('page', String(Math.max(0, Number(query.page) || 0)))
    qs.set('limit', String(Math.min(30, Number(query.limit) || 20)))
    if (query.type) qs.set('type', String(query.type))
    if (query.q) qs.set('q', String(query.q))
    if (query.sort) qs.set('sort', String(query.sort))
    return { status: true, data: await fetchDirectory(qs, user?.id) }
  })

  // Seguir / dejar de seguir una page
  // Feed paginado para el scroll infinito del navegador.
  .get('/feed', async ({ request, query }: any) => {
    const user = await sessionUser(sessionToken(request))
    const qs = new URLSearchParams()
    qs.set('scope', String(query.scope || 'foryou'))
    qs.set('page', String(Math.max(0, Number(query.page) || 0)))
    qs.set('limit', String(Math.min(30, Number(query.limit) || 25)))
    if (query.replies) qs.set('replies', '1')
    if (query.sort) qs.set('sort', String(query.sort))
    const headers: Record<string, string> = { Authorization: `Bearer ${process.env.HILOS_SECRET_KEY || ''}` }
    if (user) headers['X-Hilos-Page'] = `external:lacharca:user:${user.id}`
    const res = await fetch(`${process.env.HILOS_BASE || 'https://hilos.rest'}/v1/feed?${qs}`, { headers })
    const json: any = await res.json().catch(() => ({}))
    return { status: !json?.error, data: json?.data ?? { items: [], hasMore: false } }
  })

  // Consulta interna: CapibaraTraductor necesita el correo de un usuario de La
  // Charca para avisarle de respuestas. Protegido por secreto compartido.
  .get('/internal/user/:id', async ({ request, params }: any) => {
    const secret = process.env.INTERNAL_SECRET || ''
    if (!secret || request.headers.get('x-internal-secret') !== secret) return { status: false, message: 'forbidden' }
    const user = await prisma.user.findUnique({
      where: { id: Number(params.id) },
      include: { identities: { select: { provider: true, externalUserId: true, email: true } } },
    })
    if (!user) return { status: false, message: 'not_found' }
    const capibara = user.identities.find((i: any) => i.provider === 'capibaratraductor')
    return {
      status: true,
      data: {
        id: user.id,
        handle: user.handle,
        displayName: user.displayName,
        email: user.email || capibara?.email || null,
        capibaraUserId: capibara ? Number(capibara.externalUserId) : null,
      },
    }
  })

  // Equipo de un scan: listar, añadir y quitar. Las reglas (solo un owner
  // reparte papeles, nunca sin owner) las impone el motor.
  .get('/pages/:handle/members', async ({ request, params }: any) => {
    const user = await sessionUser(sessionToken(request))
    if (!user) return { status: false, message: 'unauthenticated' }
    try {
      const d = await (asUser(user.id) as any).members.list(String(params.handle))
      return { status: true, data: d || [] }
    } catch (e: any) { return { status: false, message: e?.code || e?.message || 'error' } }
  })

  .post('/pages/:handle/members', async ({ request, params, body }: any) => {
    const user = await sessionUser(sessionToken(request))
    if (!user) return { status: false, message: 'unauthenticated' }
    try {
      const d = await (asUser(user.id) as any).members.add(
        String(params.handle),
        String(body.handle || '').toLowerCase().replace(/^@/, ''),
        body.role === 'owner' ? 'owner' : 'trusted',
      )
      return { status: true, data: d }
    } catch (e: any) { return { status: false, message: e?.code || e?.message || 'error' } }
  }, { body: t.Object({ handle: t.String(), role: t.Optional(t.String()) }) })

  .delete('/pages/:handle/members/:member', async ({ request, params }: any) => {
    const user = await sessionUser(sessionToken(request))
    if (!user) return { status: false, message: 'unauthenticated' }
    try {
      const d = await (asUser(user.id) as any).members.remove(String(params.handle), String(params.member))
      return { status: true, data: d }
    } catch (e: any) { return { status: false, message: e?.code || e?.message || 'error' } }
  })

  // Obras que cuelgan de un scan.
  .get('/pages/:handle/subpages', async ({ request, params, query }: any) => {
    const user = await sessionUser(sessionToken(request))
    const qs = new URLSearchParams()
    qs.set('page', String(Math.max(0, Number(query.page) || 0)))
    qs.set('limit', String(Math.min(60, Number(query.limit) || 30)))
    if (query.q) qs.set('q', String(query.q))
    const headers: Record<string, string> = { Authorization: `Bearer ${process.env.HILOS_SECRET_KEY || ''}` }
    if (user) headers['X-Hilos-Page'] = `external:lacharca:user:${user.id}`
    const res = await fetch(`${process.env.HILOS_BASE || 'https://hilos.rest'}/v1/pages/${encodeURIComponent(String(params.handle))}/subpages?${qs}`, { headers })
    const json: any = await res.json().catch(() => ({}))
    return { status: !json?.error, data: json?.data ?? { items: [], hasMore: false, total: 0 } }
  })

  // Identidades con las que puedes actuar: tú y los scans de tu equipo.
  .get('/me/identities', async ({ request }: any) => {
    const user = await sessionUser(sessionToken(request))
    if (!user) return { status: false, message: 'unauthenticated' }
    try {
      const pages = await (asUser(user.id) as any).members.mine()
      return { status: true, data: pages || [] }
    } catch { return { status: true, data: [] } }
  })

  // Avisos del usuario (la vista los pinta en el servidor).
  .get('/notifications', async ({ request, query }: any) => {
    const user = await sessionUser(sessionToken(request))
    if (!user) return { status: false, message: 'unauthenticated' }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${process.env.HILOS_SECRET_KEY || ''}`,
      'X-Hilos-Page': `external:lacharca:user:${user.id}`,
    }
    const qs = new URLSearchParams({ page: String(Math.max(0, Number(query.page) || 0)), limit: '20' })
    const res = await fetch(`${process.env.HILOS_BASE || 'https://hilos.rest'}/v1/notifications?${qs}`, { headers })
    const json: any = await res.json().catch(() => ({}))
    return { status: !json?.error, data: json?.data ?? { items: [], hasMore: false } }
  })

  // Publicaciones de una page, paginadas (scroll infinito del perfil).
  .get('/pages/:handle/posts', async ({ request, params, query }: any) => {
    const user = await sessionUser(sessionToken(request))
    const qs = new URLSearchParams()
    qs.set('page', String(Math.max(0, Number(query.page) || 0)))
    qs.set('limit', String(Math.min(30, Number(query.limit) || 25)))
    if (query.sort) qs.set('sort', String(query.sort))
    qs.set('replies', '1')
    const headers: Record<string, string> = { Authorization: `Bearer ${process.env.HILOS_SECRET_KEY || ''}` }
    if (user) headers['X-Hilos-Page'] = `external:lacharca:user:${user.id}`
    const res = await fetch(`${process.env.HILOS_BASE || 'https://hilos.rest'}/v1/pages/${encodeURIComponent(String(params.handle))}/posts?${qs}`, { headers })
    const json: any = await res.json().catch(() => ({}))
    return { status: !json?.error, data: json?.data ?? { items: [], hasMore: false } }
  })

  // Ficha publica de una page (la usa la tarjeta flotante al hacer hover).
  .get('/pages/:handle', async ({ request, params }: any) => {
    const user = await sessionUser(sessionToken(request))
    try {
      const client = user ? asUser(user.id) : hilos
      const page = await client.pages.get(String(params.handle).toLowerCase())
      return { status: true, data: page }
    } catch (e: any) { return { status: false, message: e?.code || 'not_found' } }
  })

  .post('/pages/:handle/follow', async ({ request, params }: any) => {
    const user = await sessionUser(sessionToken(request))
    if (!user) return { status: false, message: 'unauthenticated' }
    try { return { status: true, data: await asUser(user.id).pages.follow(params.handle) } }
    catch (e: any) { return { status: false, message: e?.code || e?.message || 'error' } }
  })

  // Responder a un comentario (anidado)
  .post('/posts/:id/comments/:commentId/reply', async ({ request, params, body }: any) => {
    const user = await sessionUser(sessionToken(request))
    if (!user) return { status: false, message: 'unauthenticated' }
    const content = String(body.content || '').trim()
    if (!content) return { status: false, message: 'empty_comment' }
    try {
      const c = await asUser(user.id).comments.create(Number(params.id), { content, parentCommentId: Number(params.commentId) })
      return { status: true, data: c }
    } catch (e: any) { return { status: false, message: e?.code || 'error' } }
  })


  // ---- Telemetria ----
  // Quien puede ver los numeros. Por defecto solo shoko; se amplia con env.
  // (definido junto a las rutas para tenerlo a la vista)

  // Pulso de pagina vista. Lo envia el navegador, nunca el servidor.
  .post('/t/hit', async ({ request, body }: any) => {
    const ua = request.headers.get('user-agent') || ''
    if (esBot(ua)) return { status: true, data: { ignorado: 'bot' } }

    const visitorId = idVisitante(request, ua)
    if (!pasaLimite(visitorId)) return { status: true, data: { ignorado: 'limite' } }

    const path = rutaNormalizada(String(body?.path || '/'))
    const sessionId = String(body?.sid || '').slice(0, 32) || visitorId.slice(0, 32)
    const user = await sessionUser(sessionToken(request))

    try {
      await prisma.$transaction([
        prisma.visit.create({
          data: {
            visitorId, sessionId, userId: user?.id ?? null, path,
            refHost: origenExterno(body?.ref, 'lacharca.com'),
            country: pais(request), device: dispositivo(ua),
          },
        }),
        prisma.presence.upsert({
          where: { visitorId },
          create: { visitorId, userId: user?.id ?? null, handle: user?.handle ?? null, path, device: dispositivo(ua) },
          update: { userId: user?.id ?? null, handle: user?.handle ?? null, path, lastSeen: new Date() },
        }),
      ])
    } catch { /* la telemetria nunca puede romper una visita */ }
    return { status: true }
  }, { body: t.Object({ path: t.String(), ref: t.Optional(t.String()), sid: t.Optional(t.String()) }) })

  // Latido: la pestaña sigue abierta y visible. No cuenta como pagina vista.
  .post('/t/ping', async ({ request, body }: any) => {
    const ua = request.headers.get('user-agent') || ''
    if (esBot(ua)) return { status: true }
    const visitorId = idVisitante(request, ua)
    const path = rutaNormalizada(String(body?.path || '/'))
    const user = await sessionUser(sessionToken(request))
    try {
      await prisma.presence.upsert({
        where: { visitorId },
        create: { visitorId, userId: user?.id ?? null, handle: user?.handle ?? null, path, device: dispositivo(ua) },
        update: { userId: user?.id ?? null, handle: user?.handle ?? null, path, lastSeen: new Date() },
      })
    } catch { /* idem */ }
    return { status: true }
  }, { body: t.Object({ path: t.String(), sid: t.Optional(t.String()) }) })

  // Gente dentro ahora mismo (ventana de 5 minutos).
  .get('/t/live', async ({ request }: any) => {
    if (!(await esAdmin(request))) return { status: false, message: 'forbidden' }
    const desde = new Date(Date.now() - VENTANA_VIVA)
    const filas = await prisma.presence.findMany({
      where: { lastSeen: { gte: desde } },
      select: { path: true, handle: true, userId: true, device: true, lastSeen: true },
      orderBy: { lastSeen: 'desc' },
      take: 500,
    })
    const porRuta = new Map<string, number>()
    for (const f of filas) porRuta.set(f.path, (porRuta.get(f.path) || 0) + 1)
    return {
      status: true,
      data: {
        online: filas.length,
        identificados: filas.filter((f: any) => f.userId).length,
        anonimos: filas.filter((f: any) => !f.userId).length,
        movil: filas.filter((f: any) => f.device === 'movil').length,
        rutas: [...porRuta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([path, n]) => ({ path, n })),
        usuarios: [...new Set(filas.filter((f: any) => f.handle).map((f: any) => f.handle))].slice(0, 30),
      },
    }
  })

  // Resumen historico. Combina el detalle reciente con el resumen por dia.
  .get('/t/stats', async ({ request, query }: any) => {
    if (!(await esAdmin(request))) return { status: false, message: 'forbidden' }
    const dias = Math.min(90, Math.max(1, Number(query.days) || 30))
    const desde = new Date(Date.now() - dias * 86400_000)

    const [serie, totales, rutas, origenes, dispositivos, paises, recurrencia] = await Promise.all([
      prisma.$queryRaw`
        SELECT date_trunc('day', "createdAt")::date AS dia,
               count(*)::int AS pageviews,
               count(DISTINCT "visitorId")::int AS visitantes,
               count(DISTINCT "sessionId")::int AS sesiones,
               count(DISTINCT "userId")::int AS identificados
        FROM visit WHERE "createdAt" >= ${desde}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw`
        SELECT count(*)::int AS pageviews,
               count(DISTINCT "visitorId")::int AS visitantes,
               count(DISTINCT "sessionId")::int AS sesiones,
               count(DISTINCT "userId")::int AS identificados
        FROM visit WHERE "createdAt" >= ${desde}`,
      prisma.$queryRaw`
        SELECT path, count(*)::int AS n, count(DISTINCT "visitorId")::int AS visitantes
        FROM visit WHERE "createdAt" >= ${desde}
        GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
      prisma.$queryRaw`
        SELECT "refHost" AS host, count(*)::int AS n
        FROM visit WHERE "createdAt" >= ${desde} AND "refHost" IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
      prisma.$queryRaw`
        SELECT device, count(DISTINCT "visitorId")::int AS n
        FROM visit WHERE "createdAt" >= ${desde} GROUP BY 1 ORDER BY 2 DESC`,
      prisma.$queryRaw`
        SELECT country, count(DISTINCT "visitorId")::int AS n
        FROM visit WHERE "createdAt" >= ${desde} AND country IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
      // Cuantas paginas ve cada visitante: un solo golpe suele ser trafico
      // de paso; varias paginas es alguien usando la red de verdad.
      prisma.$queryRaw`
        SELECT CASE WHEN n = 1 THEN '1 pagina'
                    WHEN n <= 3 THEN '2-3 paginas'
                    WHEN n <= 10 THEN '4-10 paginas'
                    ELSE 'mas de 10' END AS tramo,
               count(*)::int AS visitantes
        FROM (SELECT "visitorId", count(*) AS n FROM visit
              WHERE "createdAt" >= ${desde} GROUP BY 1) q
        GROUP BY 1`,
    ])

    const historico = await prisma.dailyStat.findMany({ orderBy: { day: 'asc' }, take: 400 })
    return { status: true, data: { dias, serie, totales: (totales as any[])[0] || {}, rutas, origenes, dispositivos, paises, recurrencia, historico } }
  })

  .onError(({ error, set }) => { set.status = 400; return { status: false, message: (error as any)?.message || 'error' } })
  .listen(Number(process.env.PORT) || 3200)

console.log(`lacharca api on :${process.env.PORT || 3200}`)
