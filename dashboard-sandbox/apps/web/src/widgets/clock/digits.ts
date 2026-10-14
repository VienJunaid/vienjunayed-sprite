// 3×3 block font for the big clock.
const FONT: Record<string, [string, string, string]> = {
  '0': ['█▀█', '█ █', '▀▀▀'],
  '1': ['▄█ ', ' █ ', '▄█▄'],
  '2': ['▀▀█', '█▀▀', '▀▀▀'],
  '3': ['▀▀█', ' ▀█', '▀▀▀'],
  '4': ['█ █', '▀▀█', '  ▀'],
  '5': ['█▀▀', '▀▀█', '▀▀▀'],
  '6': ['█▀▀', '█▀█', '▀▀▀'],
  '7': ['▀▀█', '  █', '  ▀'],
  '8': ['█▀█', '█▀█', '▀▀▀'],
  '9': ['█▀█', '▀▀█', '▀▀▀'],
  ':': [' ', '▀', '▀'],
  ' ': [' ', ' ', ' '],
}

export function bigText(text: string): string {
  const glyphs = [...text].map((ch) => FONT[ch] ?? FONT[' '])
  return [0, 1, 2].map((row) => glyphs.map((g) => g[row]).join(' ')).join('\n')
}
