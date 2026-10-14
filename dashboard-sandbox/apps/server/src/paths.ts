import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Resolved relative to apps/server/{src,dist}/ so it works in dev and prod.
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
export const WEB_DIST = path.join(ROOT, 'apps/web/dist')
export const ASSETS_DIR = path.join(ROOT, 'assets')
export const CONFIG_DIR = path.join(ROOT, 'config')
export const DATA_DIR = path.join(ROOT, 'data') // runtime state: tokens, uploads (gitignored)
