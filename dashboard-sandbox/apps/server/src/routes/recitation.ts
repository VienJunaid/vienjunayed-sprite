import type { FastifyPluginAsync } from 'fastify'
import {
  onRecitationChange, pause, play, recitationState, recitationSurahs, resume, setMode, setVolume, startRecitation, stop,
} from '../services/recitation.js'
import { broadcast } from './events.js'

// The Quran player's remote. The server plays the audio (services/recitation.ts); every change is
// also pushed to open dashboards as a "recitation" event on /api/events.
const routes: FastifyPluginAsync = async (app) => {
  startRecitation((message) => app.log.warn(message))
  onRecitationChange((state) => broadcast('recitation', state))

  app.get('/', () => recitationState())
  app.get('/surahs', () => recitationSurahs())

  app.post<{ Body: { surah?: unknown; ayah?: unknown } }>('/play', async (req, reply) => {
    const surah = Number(req.body?.surah)
    if (!Number.isInteger(surah) || surah < 1 || surah > 114) return reply.code(400).send({ error: 'Expected a surah number' })
    return play(surah, Number(req.body?.ayah) || 0)
  })
  app.post('/pause', () => pause())
  app.post<{ Body: { force?: unknown } }>('/resume', (req) => resume(req.body?.force === true))
  app.post('/stop', () => stop())
  app.post<{ Body: { mode?: unknown } }>('/mode', (req, reply) => {
    const mode = req.body?.mode
    if (mode !== 'loop' && mode !== 'continue') return reply.code(400).send({ error: 'Expected loop or continue' })
    return setMode(mode)
  })
  app.post<{ Body: { volume?: unknown } }>('/volume', (req, reply) => {
    const volume = Number(req.body?.volume)
    if (!Number.isFinite(volume)) return reply.code(400).send({ error: 'Expected a volume from 0 to 100' })
    return setVolume(volume)
  })
}

export default routes
