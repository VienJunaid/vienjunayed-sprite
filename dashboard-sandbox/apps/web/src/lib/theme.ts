import type { Theme } from './types'

const TOKENS = ['background', 'foreground', 'accent', 'muted', 'verse'] as const
const CSS_NAMES: Record<(typeof TOKENS)[number], string> = {
  background: '--bg', foreground: '--fg', accent: '--accent', muted: '--muted', verse: '--verse',
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement.style
  for (const t of TOKENS) root.setProperty(CSS_NAMES[t], theme[t])
}

/** Resolve a sprite color: theme token ("accent", "fg"), extra theme color ("gold"), or hex. */
export function resolveColor(theme: Theme, value: string | undefined, fallback: string): string {
  if (!value) return fallback
  if (value.startsWith('#')) return value
  const aliases: Record<string, string> = {
    fg: theme.foreground, foreground: theme.foreground, accent: theme.accent,
    muted: theme.muted, verse: theme.verse, bg: theme.background, background: theme.background,
  }
  return aliases[value] ?? theme.colors?.[value] ?? fallback
}
