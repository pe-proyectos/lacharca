import type { APIRoute } from 'astro'

export const GET: APIRoute = () =>
  new Response(
    ['User-agent: *', 'Allow: /', 'Disallow: /auth/', 'Disallow: /guardados', '', 'Sitemap: https://lacharca.com/sitemap.xml', ''].join('\n'),
    { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' } },
  )
