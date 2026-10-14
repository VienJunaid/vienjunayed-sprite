import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DATA_DIR } from '../paths.js'

// Authorization Code flow. The client secret stays on the server; tokens live in data/ (gitignored).

const TOKEN_FILE = path.join(DATA_DIR, 'spotify.json')
export const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing'

interface Tokens { access_token: string; refresh_token: string; expires_at: number }
let cached: Tokens | undefined

export const clientId = () => process.env.SPOTIFY_CLIENT_ID ?? ''
const clientSecret = () => process.env.SPOTIFY_CLIENT_SECRET ?? ''
export const isConfigured = () => Boolean(clientId() && clientSecret())
export const redirectUri = () =>
  process.env.SPOTIFY_REDIRECT_URI ?? `http://127.0.0.1:${process.env.PORT ?? 8080}/api/spotify/callback`

async function loadTokens(): Promise<Tokens | undefined> {
  if (cached) return cached
  try {
    cached = JSON.parse(await readFile(TOKEN_FILE, 'utf8'))
  } catch {
    cached = undefined
  }
  return cached
}

async function saveTokens(tokens: Tokens) {
  cached = tokens
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(TOKEN_FILE, JSON.stringify(tokens), { mode: 0o600 })
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64'),
    },
    body: new URLSearchParams(body),
  })
  if (!res.ok) throw new Error(`Spotify token request failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number }
}

export async function exchangeCode(code: string) {
  const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() })
  await saveTokens({
    access_token: t.access_token,
    refresh_token: t.refresh_token!,
    expires_at: Date.now() + t.expires_in * 1000,
  })
}

export const isConnected = async () => Boolean(await loadTokens())

async function accessToken(): Promise<string | undefined> {
  const tokens = await loadTokens()
  if (!tokens) return undefined
  if (Date.now() < tokens.expires_at - 60_000) return tokens.access_token

  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token })
  await saveTokens({
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? tokens.refresh_token, // Spotify may rotate it
    expires_at: Date.now() + t.expires_in * 1000,
  })
  return t.access_token
}

export async function spotifyApi(method: string, endpoint: string) {
  const token = await accessToken()
  if (!token) return undefined
  return fetch(`https://api.spotify.com/v1${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  })
}
