import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const puppeteer = createRequire(path.join(here, '../dashboard-sandbox/package.json'))('puppeteer-core')
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1920,1080'] })
for (const scene of ['kazakh-meadow', 'madinah-maghrib', 'journey']) {
  const page = await browser.newPage(); await page.setViewport({ width: 1920, height: 1080 })
  await page.goto(`http://127.0.0.1:8090/?scene=${scene}&debug`, { waitUntil: 'load' })
  await new Promise((r) => setTimeout(r, 14000))
  console.log(scene.padEnd(18), await page.evaluate(() => document.querySelector('.stats')?.textContent)); await page.close()
}
await browser.close()
