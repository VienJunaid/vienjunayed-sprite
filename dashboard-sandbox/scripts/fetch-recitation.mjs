#!/usr/bin/env node
// Downloads the ayah timings for one reciter from mp3quran.net and writes a compact
// assets/quran/recitation.json used by the server's Quran player (services/recitation.ts).
// The audio itself is not downloaded here: the server saves each surah the first time it plays.
//   node scripts/fetch-recitation.mjs                                # read 217, named as mp3quran spells it
//   node scripts/fetch-recitation.mjs 217 "Shaykh Bandar Baleela"    # with the name to show on screen
//   node scripts/fetch-recitation.mjs 5                              # another reciter from /api/v3/ayat_timing/reads
import { readFile, writeFile } from 'node:fs/promises'

const API = 'https://www.mp3quran.net/api/v3'
const read = Number(process.argv[2] ?? 217)

const get = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json()
}

const [reads, { reciters }] = await Promise.all([get(`${API}/ayat_timing/reads`), get(`${API}/reciters?language=eng`)])
const timed = reads.find((r) => r.id === read)
if (!timed) throw new Error(`Reciter ${read} has no ayah timings on mp3quran.net`)
const english = process.argv[3] ?? reciters.find((r) => r.id === read)?.name ?? timed.name

// The timings must line up one-to-one with the text the dashboard shows
const quran = JSON.parse(await readFile(new URL('../assets/quran/quran.json', import.meta.url), 'utf8'))

const surahs = []
for (let n = 1; n <= 114; n++) {
  const rows = (await get(`${API}/ayat_timing?surah=${n}&read=${read}`)).filter((r) => r.ayah >= 1)
  const want = quran.surahs[n - 1].ayahs.length
  if (rows.length !== want || rows.some((r, i) => r.ayah !== i + 1)) {
    throw new Error(`Surah ${n}: ${rows.length} timed ayat, but quran.json has ${want}`)
  }
  if (rows.some((r, i) => r.start_time < (rows[i - 1]?.start_time ?? 0))) throw new Error(`Surah ${n}: timings go backwards`)
  // starts[i] = when ayah i+1 begins, in ms. Anything before starts[0] is the opening Bismillah.
  surahs.push({ starts: rows.map((r) => r.start_time), end: rows.at(-1).end_time })
  process.stdout.write(`\r${n}/114`)
  await new Promise((r) => setTimeout(r, 120))
}

const out = {
  source: `Audio and ayah timings: mp3quran.net (read ${read}), ${timed.rewaya}`,
  reciter: { id: read, name: english, nameArabic: timed.name, audio: timed.folder_url },
  surahs,
}
await writeFile(new URL('../assets/quran/recitation.json', import.meta.url), JSON.stringify(out))
const hours = surahs.reduce((s, x) => s + x.end, 0) / 3_600_000
console.log(`\nWrote timings for ${surahs.length} surahs by ${english} (${hours.toFixed(1)} hours)`)
