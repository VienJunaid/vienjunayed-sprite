import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ASSETS_DIR } from '../paths.js'

interface Surah {
  number: number
  name: string
  englishName: string
  translatedName: string
  ayahs: [arabic: string, translation: string][]
}
interface QuranFile { source: { arabic: string; translation: string }; surahs: Surah[] }

export interface Verse {
  key: string
  surah: { number: number; name: string; englishName: string; translatedName: string }
  ayah: number
  arabic: string
  /** The basmala that opens this surah, split off from ayah 1 for display (Tanzil text). */
  bismillah: string | null
  translation: string
  source: QuranFile['source']
}

let quran: QuranFile | undefined

const load = async () =>
  (quran ??= JSON.parse(await readFile(path.join(ASSETS_DIR, 'quran/quran.json'), 'utf8')) as QuranFile)

// Compare letters only: diacritic order varies between Unicode encodings of the same text.
const stripMarks = (text: string) => text.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
const BISMILLAH_LETTERS = 'بسم ٱلله ٱلرحمن ٱلرحيم'

/** If `text` starts with the basmala, return [basmala, rest]. */
function splitBismillah(text: string): [string, string] | undefined {
  const words = text.split(' ')
  if (stripMarks(words.slice(0, 4).join(' ')) !== BISMILLAH_LETTERS) return undefined
  return [words.slice(0, 4).join(' '), words.slice(4).join(' ').trim()]
}

export async function getVerse(surahNo: number, ayahNo: number): Promise<Verse | undefined> {
  const q = await load()
  const surah = q.surahs[surahNo - 1]
  const entry = surah?.ayahs[ayahNo - 1]
  if (!surah || !entry) return undefined

  // The Tanzil text prefixes ayah 1 of each surah (except 1 and 9) with the basmala.
  // The text file stays unmodified; we only split it off for display.
  let arabic = entry[0].replace(/^\uFEFF/, '')
  let bismillah: string | null = null
  const split = ayahNo === 1 && surahNo !== 1 ? splitBismillah(arabic) : undefined
  if (split) [bismillah, arabic] = split

  const { ayahs: _, ...meta } = surah
  return {
    key: `${surahNo}:${ayahNo}`,
    surah: meta,
    ayah: ayahNo,
    arabic,
    bismillah,
    translation: entry[1],
    source: q.source,
  }
}

/** Every surah's names and ayah count, for the recitation list. */
export async function surahList() {
  const q = await load()
  return q.surahs.map(({ ayahs, ...meta }) => ({ ...meta, ayahs: ayahs.length }))
}

/**
 * What the reciter is on, for the verse box during recitation. Ayah 0 is the opening before ayah 1:
 * the Bismillah (taken from the data, as in getVerse), or the surah's name for At-Tawbah, which has
 * none. With `opening`, ayah 1 comes without its Bismillah, since that was just shown on its own.
 */
export async function recitedVerse(surahNo: number, ayahNo: number, opening: boolean): Promise<Verse | undefined> {
  const first = await getVerse(surahNo, 1)
  if (!first) return undefined
  if (ayahNo <= 0) {
    const q = await load()
    return {
      ...first,
      key: `${surahNo}:0`,
      ayah: 0,
      arabic: first.bismillah ?? first.surah.name,
      bismillah: null,
      // Al-Fatiha 1 is the Bismillah, so its translation is the Bismillah's
      translation: first.bismillah ? q.surahs[0].ayahs[0][1] : first.surah.translatedName,
    }
  }
  if (ayahNo === 1) return opening ? { ...first, bismillah: null } : first
  return getVerse(surahNo, ayahNo)
}

export async function randomVerse(opts: { maxLength?: number; featured?: string[] }): Promise<Verse> {
  const q = await load()
  const maxLength = opts.maxLength ?? 120
  if (opts.featured?.length) {
    // Prefer featured verses that fit on screen; fall back to any featured verse.
    for (let tries = 0; tries < 20; tries++) {
      const [s, a] = opts.featured[Math.floor(Math.random() * opts.featured.length)].split(':').map(Number)
      const verse = await getVerse(s, a)
      if (verse && (verse.arabic.length <= maxLength * 1.3 || tries === 19)) return verse
    }
  }

  for (let tries = 0; tries < 200; tries++) {
    const s = 1 + Math.floor(Math.random() * q.surahs.length)
    const a = 1 + Math.floor(Math.random() * q.surahs[s - 1].ayahs.length)
    const verse = (await getVerse(s, a))!
    // Skip very long verses and lone disjoined letters (e.g. "الٓمٓ") — they don't read well alone.
    if (verse.arabic.length <= maxLength && verse.arabic.length > 12) return verse
  }
  return (await getVerse(94, 6))!
}
