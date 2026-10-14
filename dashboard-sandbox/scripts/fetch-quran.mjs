#!/usr/bin/env node
// Downloads the full Quran (Uthmani script, Tanzil) + one translation from api.alquran.cloud
// and writes a compact assets/quran/quran.json used by the server.
//   node scripts/fetch-quran.mjs            # Sahih International (en.sahih)
//   node scripts/fetch-quran.mjs en.yusufali
import { writeFile } from 'node:fs/promises'

const translation = process.argv[2] ?? 'en.sahih'
const get = async (edition) => {
  const res = await fetch(`https://api.alquran.cloud/v1/quran/${edition}`)
  if (!res.ok) throw new Error(`${edition}: HTTP ${res.status}`)
  return (await res.json()).data
}

const [ar, tr] = await Promise.all([get('quran-uthmani'), get(translation)])

const surahs = ar.surahs.map((s, i) => ({
  number: s.number,
  name: s.name,
  englishName: s.englishName,
  translatedName: s.englishNameTranslation,
  ayahs: s.ayahs.map((a, j) => [a.text, tr.surahs[i].ayahs[j].text]),
}))

const out = {
  source: {
    arabic: 'Tanzil Quran Text (Uthmani), https://tanzil.net — distributed unmodified with attribution',
    translation: `${tr.edition.englishName} (${tr.edition.identifier}) via api.alquran.cloud`,
  },
  surahs,
}
await writeFile(new URL('../assets/quran/quran.json', import.meta.url), JSON.stringify(out))
console.log(`Wrote ${surahs.length} surahs with ${translation}`)
