import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { CONFIG_DIR } from '../paths.js'

export interface DashboardConfig {
  theme: string
  prayer?: { method?: string; madhab?: 'Shafi' | 'Hanafi'; latitude?: number; longitude?: number }
  verse?: { enabled?: boolean; rotateMinutes?: number; maxLength?: number; featured?: string[] }
  /** prayerPauseMinutes: the Quran player waits this long at the start of each prayer (0 = never). */
  recitation?: { prayerPauseMinutes?: number }
  [key: string]: unknown
}

const CONFIG_FILE = path.join(CONFIG_DIR, 'dashboard.json')

// Read fresh on every call so edits apply without a restart.
export const readConfig = async (): Promise<DashboardConfig> =>
  JSON.parse(await readFile(CONFIG_FILE, 'utf8'))

export const writeConfig = (config: unknown) =>
  writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n')

export const readTheme = async (name: string) =>
  JSON.parse(await readFile(path.join(CONFIG_DIR, 'themes', `${path.basename(name)}.json`), 'utf8'))

export const listScenes = async () =>
  (await readdir(path.join(CONFIG_DIR, 'scenes')).catch(() => []))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .sort()

const sceneFile = (name: string) => path.join(CONFIG_DIR, 'scenes', `${path.basename(name)}.json`)

export const readScene = async (name: string) => JSON.parse(await readFile(sceneFile(name), 'utf8'))

export const writeScene = (name: string, scene: unknown) =>
  writeFile(sceneFile(name), JSON.stringify(scene, null, 2) + '\n')
