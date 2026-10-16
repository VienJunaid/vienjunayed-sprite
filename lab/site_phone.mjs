import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const puppeteer = createRequire(path.join(here, '../dashboard-sandbox/package.json'))('puppeteer-core')
const base = `http://127.0.0.1:${process.argv[2]}`
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
for (const [name, w, h, url] of [['phone', 390, 844, '/?scene=journey-couple'], ['tablet', 768, 1024, '/?scene=journey-couple'], ['desktop', 1920, 1080, '/?scene=journey-couple&debug']]) {
  const page = await browser.newPage(); await page.setViewport({ width: w, height: h })
  await page.goto(base + url, { waitUntil: 'networkidle0' }); await wait(name === 'desktop' ? 12000 : 3000)
  if (name === 'desktop') console.log('journey cost:', await page.evaluate(() => document.querySelector('.stats')?.textContent))
  await page.screenshot({ path: path.join(here, 'out', `site-${name}.png`) }); await page.close()
}
// the home page on a phone, with the journey as its background
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844 })
await page.evaluateOnNewDocument(() => localStorage.setItem('site:prefs', JSON.stringify({ backgrounds: { home: 'journey-couple' } })))
await page.goto(base + '/', { waitUntil: 'networkidle0' }); await wait(3000)
await page.screenshot({ path: path.join(here, 'out', 'site-phone-home.png') })
await browser.close()
