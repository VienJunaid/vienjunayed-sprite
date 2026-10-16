import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const puppeteer = createRequire(path.join(here, '../dashboard-sandbox/package.json'))('puppeteer-core')
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
for (const scene of ['kazakh-meadow', 'journey', 'journey-couple']) {
  const page = await browser.newPage(); await page.setViewport({ width: 1920, height: 1080 })
  await page.goto(`http://127.0.0.1:${process.argv[2]}/?scene=${scene}&debug`, { waitUntil: 'networkidle0' })
  let text = ''
  for (let i = 0; i < 40 && !text; i++) { await new Promise((r) => setTimeout(r, 1000)); text = await page.evaluate(() => document.querySelector('.stats')?.textContent ?? '') }
  console.log(scene.padEnd(16), text || '(no reading)'); await page.close()
}
await browser.close()
