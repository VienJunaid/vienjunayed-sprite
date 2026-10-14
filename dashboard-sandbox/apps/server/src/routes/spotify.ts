import type { FastifyPluginAsync } from 'fastify'
import { randomBytes } from 'node:crypto'
import {
  clientId, exchangeCode, isConfigured, isConnected, redirectUri, SCOPES, spotifyApi,
} from '../services/spotify.js'

const pendingStates = new Set<string>()

const ACTIONS: Record<string, [method: string, endpoint: string]> = {
  play: ['PUT', '/me/player/play'],
  pause: ['PUT', '/me/player/pause'],
  next: ['POST', '/me/player/next'],
  previous: ['POST', '/me/player/previous'],
}

const page = (msg: string) =>
  `<!doctype html><meta charset="utf-8"><body style="background:#1a1b26;color:#c0caf5;font:16px monospace;padding:3em">${msg}</body>`

const routes: FastifyPluginAsync = async (app) => {
  // Open this in a browser ON the Pi, or through an SSH tunnel (see README → Spotify).
  app.get('/login', async (_req, reply) => {
    if (!isConfigured()) return reply.type('text/html').send(page('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env, then restart.'))
    const state = randomBytes(16).toString('hex')
    pendingStates.add(state)
    const url = new URL('https://accounts.spotify.com/authorize')
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId(),
      scope: SCOPES,
      redirect_uri: redirectUri(),
      state,
    }).toString()
    return reply.redirect(url.toString())
  })

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>('/callback', async (req, reply) => {
    const { code, state, error } = req.query
    if (error || !code || !state || !pendingStates.delete(state)) {
      return reply.code(400).type('text/html').send(page(`Spotify login failed: ${error ?? 'invalid state'}`))
    }
    await exchangeCode(code)
    return reply.type('text/html').send(page('✓ Spotify connected. You can close this tab.'))
  })

  app.get('/now-playing', async () => {
    if (!isConfigured()) return { configured: false, connected: false }
    if (!(await isConnected())) return { configured: true, connected: false }

    const res = await spotifyApi('GET', '/me/player?additional_types=episode')
    if (!res || res.status === 204) return { configured: true, connected: true, active: false }
    if (!res.ok) return { configured: true, connected: true, active: false, error: res.status }

    const p = (await res.json()) as any
    const item = p.item ?? {}
    const images: { url: string; width: number }[] = item.album?.images ?? item.images ?? []
    return {
      configured: true,
      connected: true,
      active: true,
      isPlaying: Boolean(p.is_playing),
      title: item.name ?? '',
      artist: (item.artists ?? []).map((a: { name: string }) => a.name).join(', ') || item.show?.name || '',
      album: item.album?.name ?? '',
      art: images.at(-1)?.url, // smallest image — only used for a tiny ASCII thumbnail
      progressMs: p.progress_ms ?? 0,
      durationMs: item.duration_ms ?? 0,
      device: p.device?.name,
    }
  })

  // Album art proxy: lets the UI read pixels (for ASCII conversion) without CORS issues.
  app.get<{ Querystring: { url?: string } }>('/art', async (req, reply) => {
    const url = new URL(req.query.url ?? '')
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.scdn.co')) return reply.code(400).send()
    const res = await fetch(url)
    if (!res.ok) return reply.code(502).send()
    reply.header('Cache-Control', 'public, max-age=86400')
    return reply.type(res.headers.get('content-type') ?? 'image/jpeg').send(Buffer.from(await res.arrayBuffer()))
  })

  app.post<{ Params: { action: string } }>('/:action', async (req, reply) => {
    const action = ACTIONS[req.params.action]
    if (!action) return reply.code(404).send()
    const res = await spotifyApi(...action)
    if (!res) return reply.code(401).send({ error: 'Spotify not connected' })
    return reply.code(res.ok ? 200 : res.status).send({ ok: res.ok })
  })
}

export default routes
