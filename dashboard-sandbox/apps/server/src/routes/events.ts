import type { FastifyPluginAsync } from 'fastify'
import type { ServerResponse } from 'node:http'
import { watch } from 'node:fs'
import { ASSETS_DIR, CONFIG_DIR, WEB_DIST } from '../paths.js'

// Server-sent events: tells open dashboards to reload when config, assets, or the built UI change.
// That's what makes "edit dashboard.json → the Pi updates" work without touching the kiosk.
// The Quran player sends its state down the same stream (event "recitation").

const clients = new Set<ServerResponse>()
let timer: NodeJS.Timeout | undefined

/** Send an SSE event to every open dashboard. Used for live reload, by the Quran player
 *  (routes/recitation.ts), and by `/api/wallpaper` to tell a `?wallpaper` window which page to
 *  show (e.g. following an Omarchy workspace switch). */
export function broadcast(event: string, data: unknown = {}) {
  for (const res of clients) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function onChange(_: string, file: string | null) {
  if (file && (file.endsWith('~') || file.includes('.swp') || file.startsWith('.'))) return
  clearTimeout(timer)
  timer = setTimeout(() => broadcast('reload'), 300)
}

const routes: FastifyPluginAsync = async (app) => {
  for (const dir of [CONFIG_DIR, ASSETS_DIR, WEB_DIST]) {
    try {
      watch(dir, { recursive: true }, onChange)
    } catch {
      app.log.debug(`not watching ${dir}`)
    }
  }

  app.get('/', (req, reply) => {
    reply.hijack()
    const res = reply.raw
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.write('retry: 3000\n\n')
    clients.add(res)
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000)
    req.raw.on('close', () => {
      clearInterval(ping)
      clients.delete(res)
    })
  })
}

export default routes
