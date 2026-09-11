import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { randomBytes } from 'crypto'
import { prisma } from './lib/prisma'
import { createHilos } from './lib/hilos-sdk'

const CAPI_API = process.env.CAPI_API_URL || 'https://capibaratraductor.com'
const SSO_SECRET = process.env.SSO_SECRET || ''
const SESSION_DAYS = 30
const hilos = createHilos({ baseUrl: process.env.HILOS_BASE || 'https://hilos.rest', secretKey: process.env.HILOS_SECRET_KEY || '' })

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
    await syncPage(user)
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
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    const user = await sessionUser(token)
    if (!user) return { status: false, message: 'unauthenticated' }
    return { status: true, data: { user: publicUser(user) } }
  })

  // BFF: emite un page token de CORTA VIDA para que el navegador hable directo
  // con hilos.rest. Requiere sesion valida (cookie httpOnly -> Authorization).
  .post('/auth/token', async ({ request }: any) => {
    const user = await sessionUser(request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''))
    if (!user) return { status: false, message: 'unauthenticated' }
    try {
      const r = await hilos.pageTokens.create({
        externalId: `lacharca:user:${user.id}`,
        ttl: 900,
        scopes: ['read', 'post:write', 'comment:write', 'react', 'follow'],
        origin: process.env.PUBLIC_ORIGIN || 'https://lacharca.com',
      } as any)
      if (!r?.token) return { status: false, message: 'token_failed' }
      return { status: true, data: { token: r.token, expiresIn: r.expiresIn, hilosBase: process.env.HILOS_BASE || 'https://hilos.rest' } }
    } catch (e: any) { return { status: false, message: e?.code || 'token_failed' } }
  })

  .post('/auth/logout', async ({ request }: any) => {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (token) await prisma.session.deleteMany({ where: { token } })
    return { status: true }
  })

  .onError(({ error, set }) => { set.status = 400; return { status: false, message: (error as any)?.message || 'error' } })
  .listen(Number(process.env.PORT) || 3200)

console.log(`lacharca api on :${process.env.PORT || 3200}`)
