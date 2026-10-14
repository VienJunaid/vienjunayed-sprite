import type { FastifyPluginAsync } from 'fastify'
import { prayersToday } from '../services/prayer.js'

const routes: FastifyPluginAsync = async (app) => {
  app.get('/today', async (_req, reply) => {
    return (await prayersToday()) ?? reply.code(503).send({ error: 'Set LATITUDE and LONGITUDE in .env' })
  })
}

export default routes
