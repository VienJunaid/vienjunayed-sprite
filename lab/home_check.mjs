// Journey as the HOME background (clock, Salah and verse boxes stay), previewed through the picker
// and cancelled again, so the sandbox's dashboard.json is not changed.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const puppeteer = createRequire(path.join(here, '../dashboard-sandbox/package.json'))('puppeteer-core')
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1920,1080'] })
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
await page.evaluateOnNewDocument((ms) => { const real = performance.now.bind(performance); performance.now = () => real() - ms }, 8000)
await page.goto('http://127.0.0.1:8090/', { waitUntil: 'load' })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
await page.waitForSelector('button[aria-label="Open settings"]'); await wait(2500)
await page.click('button[aria-label="Open settings"]'); await wait(700)
await page.evaluate(() => [...document.querySelectorAll('.settings .row.action')].find((b) => b.textContent.includes('Home background')).click()); await wait(900)
const rows = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.textContent.trim().replace(/\s+/g, ' ')).filter((t) => t && t.length < 40))
console.log('picker rows:', rows.join(' | '))
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /journey/i.test(b.textContent)).click()); await wait(3500)
await page.screenshot({ path: path.join(here, 'out', 'journey-home-picker.png') })
await page.addStyleTag({ content: `.picker, .backdrop, section[aria-label] { visibility: hidden !important; }` })
await wait(300)
await page.screenshot({ path: path.join(here, 'out', 'journey-home.png') })
await page.keyboard.press('Escape'); await wait(800)
await browser.close()
