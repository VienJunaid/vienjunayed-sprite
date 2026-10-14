import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { existsSync } from 'node:fs'
import { ASSETS_DIR, WEB_DIST } from './paths.js'
import assetRoutes from './routes/assets.js'
import calendarRoutes from './routes/calendar.js'
import configRoutes from './routes/config.js'
import eventRoutes from './routes/events.js'
import prayerRoutes from './routes/prayer.js'
import quranRoutes from './routes/quran.js'
import recitationRoutes from './routes/recitation.js'
import spotifyRoutes from './routes/spotify.js'
import systemRoutes from './routes/system.js'
import wallpaperRoutes from './routes/wallpaper.js'

const PORT = Number(process.env.PORT ?? 8080)
const HOST = process.env.HOST ?? '127.0.0.1'

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } })

app.get('/api/health', async () => ({ ok: true }))
await app.register(configRoutes, { prefix: '/api/config' })
await app.register(assetRoutes, { prefix: '/api/assets' })
await app.register(eventRoutes, { prefix: '/api/events' })
await app.register(prayerRoutes, { prefix: '/api/prayer' })
await app.register(quranRoutes, { prefix: '/api/quran' })
await app.register(recitationRoutes, { prefix: '/api/recitation' })
await app.register(spotifyRoutes, { prefix: '/api/spotify' })
await app.register(calendarRoutes, { prefix: '/api/calendar' })
await app.register(systemRoutes, { prefix: '/api/system' })
await app.register(wallpaperRoutes, { prefix: '/api/wallpaper' })

await app.register(fastifyStatic, { root: ASSETS_DIR, prefix: '/assets/', decorateReply: false })

// In production the server also hosts the built UI. In dev, Vite does that on :5173.
if (existsSync(WEB_DIST)) {
  await app.register(fastifyStatic, { root: WEB_DIST, prefix: '/' })
} else {
  app.log.warn('apps/web/dist not found — run `npm run build` (or use `npm run dev`)')
}

await app.listen({ port: PORT, host: HOST })
