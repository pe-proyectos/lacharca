// Una sola vez (2026-10): repara avatares y banners rotos de capibaratraductor.com.
//
// Capibara paso sus imagenes a /v2/...webp y borro los originales. Para cada
// usuario, si la URL guardada (en la base o en su page de hilos) es de Capibara
// y no responde 200 image/*:
//   1. cuenta vinculada: su imagen actual en Capibara (lectura, solo lectura);
//   2. si no, la misma ruta con /v2/ y .webp;
//   3. si nada existe, vacio (nunca una URL rota).
// En hilos solo se tocan copias de Capibara rotas, nunca lo subido por el usuario.
//
// Uso (por defecto en seco):
//   DATABASE_URL=... HILOS_SECRET_KEY=... CAPI_DATABASE_URL=... bun scripts/refrescar-avatares.ts [--apply]
// Respaldo de valores anteriores en backups/avatares-<fecha>.json.

import { SQL } from 'bun'
import { mkdirSync, writeFileSync } from 'fs'
import { prisma } from '../src/lib/prisma'
import { createHilos } from '../src/lib/hilos-sdk'
import { esDeCapibara } from '../src/lib/perfil'

const APPLY = process.argv.includes('--apply')
const hilos = createHilos({ baseUrl: process.env.HILOS_BASE || 'https://hilos.rest', secretKey: process.env.HILOS_SECRET_KEY || '' })
if (!process.env.CAPI_DATABASE_URL) throw new Error('falta CAPI_DATABASE_URL')
const capi = new SQL({ url: process.env.CAPI_DATABASE_URL, prepare: false, max: 2 })

// 200 + image/*. HEAD y, si el servidor no lo admite, GET del primer byte.
const cacheOk = new Map<string, boolean>()
async function existe(url?: string | null): Promise<boolean> {
  if (!url) return false
  if (cacheOk.has(url)) return cacheOk.get(url)!
  let ok = false
  for (let i = 0; i < 3 && !ok; i++) {
    try {
      let r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15000) })
      if (r.status === 405 || r.status === 403) r = await fetch(url, { headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(15000) })
      ok = (r.status === 200 || r.status === 206) && (r.headers.get('content-type') || '').startsWith('image/')
      if (r.status === 404) break
    } catch { /* reintenta */ }
  }
  cacheOk.set(url, ok)
  return ok
}

// /profile_pictures/x.png -> /v2/profile_pictures/x.webp
function variante(url: string) {
  const u = new URL(url)
  if (u.pathname.startsWith('/v2/')) return null
  u.pathname = '/v2' + u.pathname.replace(/\.[a-z0-9]+$/i, '.webp')
  return u.toString()
}

const CAMPOS = [['avatarUrl', 'imageUrl'], ['bannerUrl', 'bannerUrl']] as const

async function main() {
  const users = await prisma.user.findMany({ include: { identities: true }, orderBy: { id: 'asc' } })

  // Imagen actual en Capibara de las cuentas vinculadas (solo lectura).
  const ids = users.flatMap((u) => u.identities.filter((i) => i.provider === 'capibaratraductor').map((i) => Number(i.externalUserId))).filter(Boolean)
  const filas: any[] = ids.length ? await capi.begin(async (tx) => {
    await tx`SET TRANSACTION READ ONLY`
    return tx`SELECT id, "imageUrl", "bannerUrl" FROM "user" WHERE id IN ${tx(ids)}`
  }) : []
  const enCapi = new Map<number, any>(filas.map((f) => [Number(f.id), f]))

  // Pages de hilos de todos, en bloques de 100.
  const pages = new Map<string, any>()
  for (let i = 0; i < users.length; i += 100) {
    const r = await hilos.pages.byExternal(users.slice(i, i + 100).map((u) => `lacharca:user:${u.id}`))
    for (const p of r.items) pages.set(p.externalId!, p)
  }

  const cambios: { id: number; handle: string; target: 'db' | 'hilos'; field: string; old: string | null; new: string | null; via: string }[] = []
  for (const u of users) {
    const vinc = u.identities.find((i) => i.provider === 'capibaratraductor')
    const capiRow = vinc ? enCapi.get(Number(vinc.externalUserId)) : null
    const page = pages.get(`lacharca:user:${u.id}`)
    for (const [campo, campoCapi] of CAMPOS) {
      const enBase = (u as any)[campo] as string | null
      const enPage = page ? (page[campo] as string | null) : null
      const baseRota = esDeCapibara(enBase) && !(await existe(enBase))
      const pageRota = esDeCapibara(enPage) && !(await existe(enPage))
      if (!baseRota && !pageRota) continue

      let nuevo: string | null = null, via = 'vacio'
      const rota = (baseRota ? enBase : enPage)!
      if (capiRow) {
        const actual = capiRow[campoCapi] as string | null
        if (actual && await existe(actual)) { nuevo = actual; via = 'capibara' }
        else if (actual) {
          const v = variante(rota)
          if (v && await existe(v)) { nuevo = v; via = 'v2' }
        }
      } else {
        const v = variante(rota)
        if (v && await existe(v)) { nuevo = v; via = 'v2' }
      }
      if (baseRota) cambios.push({ id: u.id, handle: u.handle, target: 'db', field: campo, old: enBase, new: nuevo, via })
      if (pageRota) cambios.push({ id: u.id, handle: u.handle, target: 'hilos', field: campo, old: enPage, new: nuevo, via })
    }
  }

  // Resumen.
  const cuenta = (f: (c: typeof cambios[number]) => boolean) => cambios.filter(f).length
  for (const target of ['db', 'hilos'] as const) for (const field of ['avatarUrl', 'bannerUrl']) {
    const t = (c: any) => c.target === target && c.field === field
    console.log(`${target} ${field}: ${cuenta(t)} rotos -> capibara ${cuenta((c) => t(c) && c.via === 'capibara')}, v2 ${cuenta((c) => t(c) && c.via === 'v2')}, vacio ${cuenta((c) => t(c) && c.via === 'vacio')}`)
  }
  for (const c of cambios.filter((c) => c.via === 'vacio')) console.log(`  vacio: #${c.id} @${c.handle} ${c.target}.${c.field} ${c.old}`)
  if (!APPLY) { console.log('\nEn seco. Repite con --apply para escribir.'); return }

  // Respaldo antes de escribir.
  const dir = new URL('../backups/', import.meta.url).pathname
  mkdirSync(dir, { recursive: true })
  const archivo = `${dir}avatares-${new Date().toISOString().slice(0, 10)}.json`
  writeFileSync(archivo, JSON.stringify(cambios, null, 2))
  console.log(`\nRespaldo: ${archivo}`)

  let db = 0, hl = 0, fallos = 0
  for (const c of cambios) {
    try {
      if (c.target === 'db') { await prisma.user.update({ where: { id: c.id }, data: { [c.field]: c.new } }); db++ }
      else {
        const page = pages.get(`lacharca:user:${c.id}`)
        await hilos.pages.update(page.handle, { [c.field]: c.new } as any); hl++
      }
    } catch (e: any) { fallos++; console.error(`fallo #${c.id} ${c.target}.${c.field}: ${e?.message || e}`) }
  }
  console.log(`Aplicado: base ${db}, hilos ${hl}, fallos ${fallos}`)
}

main().finally(async () => { await prisma.$disconnect(); await capi.close() })
