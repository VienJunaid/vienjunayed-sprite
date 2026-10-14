import type { FastifyPluginAsync } from 'fastify'
import { readConfig } from '../services/config.js'
import { getVerse, randomVerse } from '../services/quran.js'

const routes: FastifyPluginAsync = async (app) => {
  app.get('/random', async () => {
    const { verse = {} } = await readConfig()
    return randomVerse({ maxLength: verse.maxLength, featured: verse.featured })
  })

  app.get<{ Params: { surah: string; ayah: string } }>('/:surah/:ayah', async (req, reply) => {
    const verse = await getVerse(Number(req.params.surah), Number(req.params.ayah))
    return verse ?? reply.code(404).send({ error: 'No such verse' })
  })
}

export default routes
