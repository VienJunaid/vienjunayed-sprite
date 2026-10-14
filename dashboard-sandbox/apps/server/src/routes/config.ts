import type { FastifyPluginAsync } from 'fastify'
import { listScenes, readConfig, readScene, readTheme, writeConfig, writeScene } from '../services/config.js'

const routes: FastifyPluginAsync = async (app) => {
  app.get('/', () => readConfig())

  // Used by the importer ("use as background" / "add to scene"). The file watcher
  // in routes/events.ts then tells the kiosk to reload.
  app.put('/', async (req, reply) => {
    const body = req.body as { theme?: unknown } | null
    if (!body || typeof body !== 'object' || typeof body.theme !== 'string') {
      return reply.code(400).send({ error: 'Expected a dashboard config object' })
    }
    await writeConfig(body)
    return { ok: true }
  })

  app.get<{ Params: { name: string } }>('/themes/:name', (req) => readTheme(req.params.name))

  app.get('/scenes', () => listScenes())
  app.get<{ Params: { name: string } }>('/scenes/:name', (req) => readScene(req.params.name))
  app.put<{ Params: { name: string }; Body: { characters?: unknown } }>('/scenes/:name', async (req, reply) => {
    if (!Array.isArray(req.body?.characters)) return reply.code(400).send({ error: 'Expected a scene object' })
    await writeScene(req.params.name, req.body)
    return { ok: true }
  })
}

export default routes
