// Stills of the sandbox "journey" scene at chosen moments of its loop: node journey_shots.mjs 5 20 ...
// The scene clock is shifted by moving performance.now() back before the page starts.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const puppeteer = createRequire(path.join(here, '../dashboard-sandbox/package.json'))('puppeteer-core')
const times = process.argv.slice(2).map(Number)
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1920,1080'] })
for (const at of times) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080 })
  await page.evaluateOnNewDocument((ms) => { const real = performance.now.bind(performance); performance.now = () => real() - ms }, Math.max(0, at - 5) * 1000)
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.log('  page:', m.text().slice(0, 160)) })
  await page.goto('http://127.0.0.1:8090/?scene=journey&debug', { waitUntil: 'load' })
  await page.addStyleTag({ content: `.exit-scenery, .open-settings { display: none !important; }` })
  await new Promise((r) => setTimeout(r, 5000))
  console.log(at, await page.evaluate(() => document.querySelector('.stats')?.textContent))
  await page.addStyleTag({ content: `.stats { display: none !important; }` })
  await page.screenshot({ path: path.join(here, 'out', `journey-${String(at).padStart(3, '0')}.png`) })
  await page.close()
}
await browser.close()
