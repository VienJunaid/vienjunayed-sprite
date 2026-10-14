import type { FastifyPluginAsync } from 'fastify'
import { broadcast } from './events.js'

// Lets an external driver (the Omarchy workspace watcher) tell any open `?wallpaper` window which
// page to show, without a full reload. See lib/api.ts `watchForReload`'s wallpaper-page listener.

const routes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { page?: number } }>('/page', async (req, reply) => {
    const { page } = req.body ?? {}
    if (typeof page !== 'number' || !Number.isInteger(page) || page < 0) {
      reply.code(400)
      return { error: 'page must be a non-negative integer' }
    }
    broadcast('wallpaper-page', { page })
    return { ok: true }
  })
}

export default routes
