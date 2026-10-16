// Checks the Horse journey on the website (served locally): node site_check.mjs <port>
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const puppeteer = createRequire(path.join(here, '../dashboard-sandbox/package.json'))('puppeteer-core')
const base = `http://127.0.0.1:${process.argv[2]}`
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const errors = []
async function open(url, w, h) {
  const page = await browser.newPage()
  await page.setViewport({ width: w, height: h })
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  await page.goto(base + url, { waitUntil: 'networkidle0' })
  await wait(2500)
  return page
}
const shot = (page, n) => page.screenshot({ path: path.join(here, 'out', `site-${n}.png`) })
const prefs = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('site:prefs') ?? '{}').backgrounds?.home ?? '(none)')
const choice = (page, i) => page.evaluate((i) => document.querySelectorAll('.settings .choices button')[i].click(), i)
const labels = (page) => page.evaluate(() => [...document.querySelectorAll('.settings .choices button')].map((b) => b.textContent.trim()))

const page = await open('/?prayer=maghrib', 1920, 1080)
console.log('site booted (html.js still set):', await page.evaluate(() => document.documentElement.classList.contains('js')))
await page.click('#clock'); await wait(600)
console.log('row buttons:', await labels(page), '| home background:', await prefs(page))
await shot(page, '1-settings')
await choice(page, 0); await wait(3500)
console.log('scenery option -> scenery mode:', await page.evaluate(() => document.body.classList.contains('scenery')))
await shot(page, '2-scenery')
await page.keyboard.press('Escape'); await wait(1500)
await page.click('#clock'); await wait(600)
await choice(page, 1); await wait(3500)
console.log('as home -> home background:', await prefs(page))
await shot(page, '3-home')
await page.click('#clock'); await wait(600)
console.log('row buttons now:', await labels(page))
await page.keyboard.press('Escape'); await wait(400)
// A text page's picker must offer the road without the couple, never the couple's version
await page.goto(base + '/?prayer=maghrib#about'); await wait(2500)
await page.click('#bg-button'); await wait(600)
const options = await page.evaluate(() => [...document.querySelectorAll('.picker .option')].map((b) => b.textContent.trim()))
console.log('About picker has Journey:', options.includes('Journey'), '| has the couple version:', options.some((o) => /horse|couple/i.test(o)))
await page.evaluate(() => [...document.querySelectorAll('.picker .option')].find((b) => b.textContent.trim() === 'Journey').click()); await wait(3500)
await page.evaluate(() => { for (const s of document.querySelectorAll('.sheet, .backdrop')) s.style.visibility = 'hidden' })
await shot(page, '4-about-journey')
await page.keyboard.press('Escape'); await wait(600)
await page.goto(base + '/?prayer=maghrib#home'); await wait(2500)
await page.click('#clock'); await wait(600)
await choice(page, 1); await wait(1500)
console.log('toggled back -> home background:', await prefs(page))
await page.close()

const stats = await open('/?scene=journey-couple&debug', 1920, 1080)
await wait(6000)
console.log('journey cost:', await stats.evaluate(() => document.querySelector('.stats')?.textContent))
await stats.close()
const phone = await open('/?scene=journey-couple', 390, 844)
await shot(phone, '5-phone-scenery')
await phone.close()
console.log('page errors:', errors.length ? errors : 'none')
await browser.close()
