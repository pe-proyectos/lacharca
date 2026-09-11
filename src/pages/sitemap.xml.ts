import type { APIRoute } from 'astro'
import { hilos } from '../lib/hilos'

const SITE = 'https://lacharca.com'
const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string))

// Sitemap real: secciones fijas + las pages del directorio (scans, obras y lectores).
export const GET: APIRoute = async () => {
  const urls: { loc: string; priority: string; changefreq: string }[] = [
    { loc: `${SITE}/`, priority: '1.0', changefreq: 'hourly' },
    { loc: `${SITE}/explorar`, priority: '0.8', changefreq: 'hourly' },
    { loc: `${SITE}/scans`, priority: '0.8', changefreq: 'daily' },
  ]

  for (let page = 0; page < 20; page++) {
    const d = await hilos(`/pages/directory?page=${page}&limit=100`).catch(() => null)
    const items = d?.items || []
    for (const p of items) urls.push({ loc: `${SITE}/@${encodeURIComponent(p.handle)}`, priority: '0.6', changefreq: 'weekly' })
    if (!d?.hasMore) break
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`

  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}
