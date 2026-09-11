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
async function sessionUser(token?: string | null) {
  if (!token) return null
  const s = await prisma.session.findUnique({ where: { token }, include: { user: true } })
  if (!s || s.expiresAt < new Date()) return null
  return s.user
}

const app = new Elysia()
  .use(cors({ origin: true, credentials: true }))
  .get('/health', () => ({ ok: true, service: 'lacharca-api' }))

  // Canjea el codigo SSO de capibaratraductor: crea/vincula la cuenta PROPIA
  // de La Charca, provisiona su Page en hilos.rest y abre sesion propia.
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

    // ¿Ya vinculada?
    let identity = await prisma.linkedIdentity.findUnique({
      where: { provider_externalUserId: { provider: 'capibaratraductor', externalUserId: String(ext.id) } },
      include: { user: true },
    })
    let user = identity?.user ?? null

    if (!user) {
      // Alta automatica (1 clic): cuenta propia de La Charca.
      const handle = await uniqueHandle(ext.slug || ext.username || 'capi')
      user = await prisma.user.create({
        data: { handle, displayName: ext.username || handle, avatarUrl: ext.imageUrl || null, bannerUrl: ext.bannerUrl || null, bio: ext.description || null, email: ext.email || null },
      })
      await prisma.linkedIdentity.create({
        data: { userId: user.id, provider: 'capibaratraductor', externalUserId: String(ext.id), externalHandle: ext.slug || ext.username || null, email: ext.email || null },
      })
    }

    // Provisiona/actualiza la Page en hilos.rest (la identidad social).
    try {
      const page = await hilos.pages.upsert({
        externalId: `lacharca:user:${user.id}`, handle: user.handle, type: 'user',
        displayName: user.displayName || user.handle, avatarUrl: user.avatarUrl || undefined, bio: user.bio || undefined,
        createdAt: new Date(user.createdAt).toISOString(),
      })
      if (page?.id && page.id !== user.hilosPageId) await prisma.user.update({ where: { id: user.id }, data: { hilosPageId: page.id } })
    } catch { /* la sesion no depende de hilos */ }

    const token = randomBytes(32).toString('hex')
    await prisma.session.create({ data: { userId: user.id, token, expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000) } })
    return { status: true, data: { token, user: { id: user.id, handle: user.handle, displayName: user.displayName, avatarUrl: user.avatarUrl } } }
  }, { body: t.Object({ code: t.String() }) })

  // Sesion actual (+ page token de hilos para acciones del cliente).
  .get('/auth/me', async ({ request }: any) => {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    const user = await sessionUser(token)
    if (!user) return { status: false, message: 'unauthenticated' }
    let pageToken: string | null = null
    try { pageToken = (await hilos.pageTokens.create({ externalId: `lacharca:user:${user.id}`, ttl: 3600 }))?.token ?? null } catch {}
    return { status: true, data: { user: { id: user.id, handle: user.handle, displayName: user.displayName, avatarUrl: user.avatarUrl, bio: user.bio }, pageToken } }
  })

  .post('/auth/logout', async ({ request }: any) => {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (token) await prisma.session.deleteMany({ where: { token } })
    return { status: true }
  })

  .onError(({ error, set }) => { set.status = 400; return { status: false, message: (error as any)?.message || 'error' } })
  .listen(Number(process.env.PORT) || 3200)

console.log(`lacharca api on :${process.env.PORT || 3200}`)
