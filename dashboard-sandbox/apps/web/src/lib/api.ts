import type { BackgroundAsset, CharacterAsset, DashboardConfig, SceneConfig, Theme } from './types'

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export const api = {
  config: () => get<DashboardConfig>('/api/config'),
  saveConfig: (config: DashboardConfig) =>
    fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }),
  sceneList: () => get<string[]>('/api/config/scenes'),
  scene: (name: string) => get<SceneConfig>(`/api/config/scenes/${encodeURIComponent(name)}`),
  saveScene: (name: string, scene: SceneConfig) =>
    fetch(`/api/config/scenes/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scene),
    }),
  theme: (name: string) => get<Theme>(`/api/config/themes/${encodeURIComponent(name)}`),
  character: (name: string) => get<CharacterAsset>(`/assets/characters/${encodeURIComponent(name)}.json`),
  background: (name: string) => get<BackgroundAsset>(`/assets/backgrounds/${encodeURIComponent(name)}.json`),
  assetList: () => get<{ characters: string[]; backgrounds: string[] }>('/api/assets'),
  saveAsset: (kind: 'character' | 'background', asset: object) =>
    fetch(`/api/assets/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asset),
    }),
  get,
}

let events: EventSource | undefined
/** The one server-sent event stream the page keeps open: live reload, the Quran player, and
 *  `?wallpaper` page-sync events (see `POST /api/wallpaper/page`). */
export const serverEvents = () => (events ??= new EventSource('/api/events'))

/** Reload the page when the server reports config/asset/build changes. `onWallpaperPage`, if
 *  given, is called when something (e.g. an Omarchy workspace switch) asks a `?wallpaper` window
 *  to show a different page — see `POST /api/wallpaper/page`. */
export function watchForReload(onWallpaperPage?: (page: number) => void) {
  const reload = () => location.reload()
  serverEvents().addEventListener('reload', reload)

  const onPage = onWallpaperPage
    ? (e: Event) => {
        try {
          const { page } = JSON.parse((e as MessageEvent).data)
          if (typeof page === 'number') onWallpaperPage(page)
        } catch {
          /* ignore malformed event */
        }
      }
    : undefined
  if (onPage) serverEvents().addEventListener('wallpaper-page', onPage)

  return () => {
    serverEvents().removeEventListener('reload', reload)
    if (onPage) serverEvents().removeEventListener('wallpaper-page', onPage)
  }
}
