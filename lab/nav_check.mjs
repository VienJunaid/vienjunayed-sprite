// Checks the sandbox navigation change: scene taps do nothing, Settings steps pages.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const puppeteer = createRequire(path.join(here, '../dashboard-sandbox/package.json'))('puppeteer-core')
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1366,768'] })
const page = await browser.newPage()
await page.setViewport({ width: 1366, height: 768 })
await page.goto('http://127.0.0.1:8090/?prayer=maghrib', { waitUntil: 'load' })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const pageNo = () => page.evaluate(() => sessionStorage.getItem('dashboard:page'))
const has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel)
const where = () => page.evaluate(() => document.querySelector('.settings .row .label small')?.textContent)
await wait(4000)
const log = (k, v) => console.log(k.padEnd(52), v)
log('start page', await pageNo())
await page.mouse.click(640, 560); await wait(1500)            // on the couple (left half)
await page.mouse.click(1200, 500); await wait(1500)           // right half of the scene
await page.mouse.move(900, 400); await page.mouse.down(); await page.mouse.move(500, 400, { steps: 8 }); await page.mouse.up(); await wait(1500)
log('after tap on couple, tap right half, swipe', await pageNo())
log('home: gear shown (clock is the button, expect false)', await has('main > button.open-settings'))
await page.click('button.open-settings'); await wait(600)      // the clock
log('settings open, row says', await where())
await page.click('.settings .steps button[aria-label="Next"]'); await wait(1500)
log('after Settings ▸', `${await pageNo()} | ${await where()}`)
await page.keyboard.press('Escape'); await wait(1500)
log('page 2: gear shown (expect true)', await has('main > button.open-settings'))
await page.screenshot({ path: path.join(here, 'out', 'nav-page2.png') })
await page.mouse.click(683, 400); await wait(1500)            // the Kaaba, clear of the side cards
log('page 2 after tap on scene', await pageNo())
await page.click('main > button.open-settings'); await wait(600)
await page.screenshot({ path: path.join(here, 'out', 'nav-settings.png') })
await page.evaluate(() => [...document.querySelectorAll('.settings .row.action')].find((b) => b.textContent.includes('Scenery mode')).click()); await wait(1500)
log('scenery: gear shown (expect true)', await has('main > button.open-settings'))
await page.mouse.click(1200, 500); await wait(1500)
await page.click('main > button.open-settings'); await wait(600)
const before = await where()
await page.click('.settings .steps button[aria-label="Next"]'); await wait(1500)
log('scenery: tap on scene then Settings ▸', `${before}  ->  ${await where()}`)
await browser.close()
