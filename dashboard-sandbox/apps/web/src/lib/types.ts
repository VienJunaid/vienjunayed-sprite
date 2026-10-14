export type Area =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'
  /** Centered on the Haram scene's rooftop bands, either side of the mataf. */
  | 'rooftop-left' | 'rooftop-right'
  /** The whole page, above the Background box (the System page). */
  | 'full'

export type Anchor = 'top-left' | 'top-center' | 'center' | 'bottom-center' | 'bottom-left'

export interface SpriteConfig {
  asset: string
  /** Position as a fraction of the screen (0–1). */
  x: number
  y: number
  anchor?: Anchor
  /** Theme token (fg, accent, muted, verse, …) or a hex color. */
  color?: string
  /** Mirror the sprite into the water below it. */
  reflect?: boolean
  /** Mirror left ↔ right. */
  flip?: boolean
}

export interface SceneConfig {
  /** Optional theme that goes with this scene (overrides dashboard.json → theme). */
  theme?: string
  background: string
  characters: SpriteConfig[]
}

export interface PageConfig {
  /** Scene name (config/scenes/) or inline scene. */
  scene?: SceneConfig | string
  /** Instead of one scene: a scene per prayer period (Fajr runs until Dhuhr, Isha until Fajr). */
  sceneByPrayer?: Partial<Record<'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', SceneConfig | string>>
  /** `true`: the shared widgets from dashboard.json → widgets. Or this page's own list. */
  widgets?: boolean | WidgetConfig[]
  /** Background chosen in the dashboard (a config/scenes name). Wins over `scene` / `sceneByPrayer`. */
  sceneOverride?: string
  /**
   * No scene at all: a solid background, and the render loop paused (the System page, where an
   * animated scene behind blurred panels made the Pi lag). `scene` then only sets the theme.
   */
  plain?: boolean
  /** Show the rotating Quran verse on this page. */
  verse?: boolean
}

export interface DashboardConfig {
  theme: string
  /** Swipeable pages. Without it, the dashboard is a single page built from `scene`. */
  pages?: PageConfig[]
  fps: number
  /**
   * Grid size. `rows` fixes the composition on every screen (cells scale with the display);
   * cellWidth / cellHeight set the cell shape (and the cell size in px when `rows` is omitted).
   */
  grid: { rows?: number; cellWidth: number; cellHeight: number }
  /** Inline scene, or the name of a file in config/scenes/. */
  scene: SceneConfig | string
  verse: { enabled: boolean; rotateMinutes: number; maxLength?: number; featured?: string[] }
  /** showCurrent: keep the current prayer's pixel name (and time) on the home screen all period. */
  prayer: { method: string; madhab: 'Shafi' | 'Hanafi'; showCurrent?: boolean }
  widgets: WidgetConfig[]
  /** prayerPauseMinutes: the Quran player waits this long at the start of each prayer (0 = never). */
  recitation?: { prayerPauseMinutes?: number }
  /** offset: shift Hijri dates by −1/+1 day to match the local masjid's moonsighting. */
  hijri?: { offset?: number }
}

export interface WidgetConfig {
  id: string
  area: Area
  options?: Record<string, unknown>
}

export interface Theme {
  name: string
  background: string
  foreground: string
  accent: string
  muted: string
  verse: string
  /** Optional extra named colors usable by sprites (e.g. "gold"). */
  colors?: Record<string, string>
  /** Default brightness ramp, dark → bright. */
  ramp: string
}

export interface CharacterAsset {
  name: string
  fps?: number
  /** Character treated as see-through (default: space). */
  transparent?: string
  frames: string[][]
  color?: string
  /** Fill spaces enclosed by the outline so the background doesn't show through. */
  solid?: boolean
  /**
   * Pixel-art mode: maps each character in `frames` to a hex color ("." and " " are
   * transparent). Rendered with half blocks, two pixels per text cell vertically.
   */
  palette?: Record<string, string>
}

export interface ProceduralBackground {
  name: string
  type: 'procedural'
  effect: string
  params?: Record<string, unknown>
}

export interface FramesBackground {
  name: string
  type: 'frames'
  fps?: number
  /** Characters ordered dark → bright; used to shade frames. Defaults to the theme ramp. */
  ramp?: string
  /** Pixel-art mode (same as characters): frames are palette keys, stretched to fill the screen. */
  palette?: Record<string, string>
  frames: string[][]
}

export type BackgroundAsset = ProceduralBackground | FramesBackground
