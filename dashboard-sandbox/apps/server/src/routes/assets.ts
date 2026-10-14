import type { FastifyPluginAsync } from 'fastify'
import { readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ASSETS_DIR } from '../paths.js'

const KINDS = { character: 'characters', background: 'backgrounds' } as const
type Kind = keyof typeof KINDS

const listJson = async (dir: string) =>
  (await readdir(path.join(ASSETS_DIR, dir)).catch(() => []))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .sort()

const routes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => ({
    characters: await listJson('characters'),
    backgrounds: await listJson('backgrounds'),
  }))

  // Save an asset produced by the importer page.
  app.post<{ Params: { kind: string }; Body: { name?: string; frames?: unknown } }>(
    '/:kind',
    { bodyLimit: 32 * 1024 * 1024 },
    async (req, reply) => {
      const dir = KINDS[req.params.kind as Kind]
      const { name, frames } = req.body ?? {}
      if (!dir) return reply.code(404).send({ error: 'kind must be character or background' })
      if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9-_]{0,63}$/i.test(name)) {
        return reply.code(400).send({ error: 'name must be letters, numbers, - or _' })
      }
      if (!Array.isArray(frames) || frames.length === 0) {
        return reply.code(400).send({ error: 'frames must be a non-empty array' })
      }
      await writeFile(path.join(ASSETS_DIR, dir, `${name}.json`), JSON.stringify(req.body))
      return { ok: true, name }
    },
  )
}

export default routes
