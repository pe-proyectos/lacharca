import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import bun from '@nurodev/astro-bun'
import react from '@astrojs/react'

export default defineConfig({
  server: { host: true, port: Number(process.env.PORT) || 4321 },
  adapter: bun(),
  output: 'server',
  vite: { plugins: [tailwindcss()] },
  integrations: [react()],
})
