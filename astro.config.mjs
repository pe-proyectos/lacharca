import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import bun from '@nurodev/astro-bun'
import react from '@astrojs/react'

export default defineConfig({
  server: { host: true, port: Number(process.env.PORT) || 4321 },
  adapter: bun(),
  output: 'server',
  // Detras del proxy Astro ve http:// y su checkOrigin rechaza el POST del
  // formulario. La proteccion CSRF real la da el ticket en cookie SameSite=Lax.
  security: { checkOrigin: false },
  vite: { plugins: [tailwindcss()] },
  integrations: [react()],
})
