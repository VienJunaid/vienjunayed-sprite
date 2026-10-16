#!/usr/bin/env node
// Generates the couple (Vien & his wife) for the prayer-time home scenes, one outfit per place:
//   palestine (Fajr, Al-Aqsa) · hajj (Dhuhr, Kaaba) · turkey (Asr, Hagia Sophia)
//   saudi (Maghrib, Madinah) · atlanta (Isha, Al-Farooq night market)
//   node scripts/art/couple.mjs
// Faces are plain on purpose: no eyes, nose or mouth. The niqab is fully black.
import { Pix, hash, save } from './lib.mjs'

console.log('Generating couple outfits:')

const inE = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
const SKIN = { F: '#e2b793', f: '#c8997a' }
const HAIR = { h: '#1a1616', i: '#3a3434' }

/** Plain face oval, shaded on the right. */
function face(p, cx, cy, rx, ry) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (inE(x, y, cx, cy, rx, ry)) p.set(x, y, x >= cx + rx - 1.5 ? 'f' : 'F')
}

/** Fill a robe/garment silhouette: hw(y) half-width, color(x, y, xr, hw) → key. */
function body(p, cx, y0, y1, hw, color, sway = 0) {
  for (let y = y0; y <= y1; y++) {
    const w = Math.round(hw(y))
    const s = y > y1 - 4 ? sway : 0
    for (let x = cx - w + s; x <= cx + w + s; x++) p.set(x, y, color(x, y, x - cx - s, w))
  }
}

// ═══════════════════════════════════════════════════════ Man  (26 × 54)
const MW = 26, MH = 54, mx = 13
const manHW = (y) => (y < 16 ? 5 : y < 30 ? 7 : 7 + ((y - 30) / 21) * 2.2)

function manHead(p, { hair = true } = {}) {
  if (hair) for (let y = 1; y <= 12; y++) for (let x = mx - 6; x <= mx + 6; x++) if (inE(x, y, mx, 7, 5.3, 5.6)) p.set(x, y, (x * 3 + y) % 7 === 0 ? 'i' : 'h')
  face(p, mx, 9.6, 3.8, 4.6)
  if (hair) { p.set(mx - 3, 5, 'h'); p.set(mx - 2, 5, 'h'); p.set(mx + 1, 5, 'h'); p.set(mx + 3, 5, 'h') } // fringe
  p.set(mx, 15, 'f'); p.set(mx - 1, 15, 'f'); p.set(mx + 1, 15, 'f') // neck
}
function hands(p, y, key = 'F') {
  p.set(mx - 8, y, key); p.set(mx - 8, y + 1, key); p.set(mx + 8, y, 'f'); p.set(mx + 8, y + 1, 'f')
}
function sandals(p) {
  for (const dx of [-3, -2, -1, 1, 2, 3]) p.set(mx + dx, MH - 1, 'S')
}

const men = {
  // White thobe, black-and-white keffiyeh draped over the shoulders
  palestine: {
    palette: { ...SKIN, ...HAIR, T: '#f3eee4', t: '#cfc5b6', K: '#efe9dc', k: '#26222b', S: '#5a3b28', r: '#e8a070' },
    draw: (p, sway) => {
      body(p, mx, 15, MH - 2, manHW, (x, y, xr, w) => (xr === -w ? 'r' : xr > 1 ? 't' : 'T'), sway)
      const net = (x, y) => ((x + y) % 3 === 0 || (((x - y) % 3) + 3) % 3 === 0 ? 'k' : 'K')
      for (let y = 15; y <= 17; y++) for (let x = mx - 6; x <= mx + 6; x++) p.set(x, y, net(x, y))
      for (let y = 18; y <= 29; y++) {
        p.rect(mx - 5, y, mx - 3, y, (x) => (y === 29 ? (x % 2 ? 'K' : 'k') : net(x, y)))
        if (y <= 27) p.rect(mx + 3 + (y > 24 ? sway : 0), y, mx + 5 + (y > 24 ? sway : 0), y, (x) => (y === 27 ? (x % 2 ? 'K' : 'k') : net(x, y)))
      }
      hands(p, 31); sandals(p); manHead(p)
    },
  },
  // Ihram: two plain white cloths, the upper one wrapped over both shoulders
  hajj: {
    palette: { ...SKIN, ...HAIR, I: '#f8f7f3', j: '#dedbd3', J: '#c3bfb5', S: '#6b4a33' },
    draw: (p, sway) => {
      body(p, mx, 15, MH - 2, (y) => (y < 16 ? 5 : y < 32 ? 7 : 6.5 + ((y - 32) / 20) * 1.5), (x, y, xr) => {
        if (y === 32) return 'J' // where the upper cloth meets the izar
        if (y < 32 && xr === Math.round((y - 22) * 0.6)) return 'j' // diagonal fold of the rida
        return xr > 2 ? 'j' : 'I'
      }, sway)
      hands(p, 30); sandals(p); manHead(p)
    },
  },
  // Ottoman-style kaftan: deep navy with gold frogging and a red sash
  turkey: {
    palette: { ...SKIN, ...HAIR, N: '#1f2a4d', n: '#2e3d6b', G: '#d9a441', R: '#a82b2b', W: '#f1ece2', S: '#3a2a20' },
    draw: (p, sway) => {
      body(p, mx, 15, MH - 2, manHW, (x, y, xr, w) => {
        if (y >= 28 && y <= 29) return 'R'
        if (Math.abs(xr) <= 1 && y < 22) return 'W'
        if (xr === 0 && y >= 22) return 'G'
        if (Math.abs(xr) === 2 && y >= 16 && y <= 27 && y % 3 === 0) return 'G' // frogging
        return xr < -w + 3 ? 'n' : 'N'
      }, sway)
      hands(p, 31); sandals(p); manHead(p)
    },
  },
  // White thobe with a red-and-white shemagh and black agal
  saudi: {
    palette: { ...SKIN, T: '#f7f5ef', t: '#d8d3c8', R: '#c8323a', W: '#f2ede4', A: '#141117', S: '#6b4a33', r: '#e8a070' },
    draw: (p, sway) => {
      body(p, mx, 15, MH - 2, manHW, (x, y, xr, w) => (xr === -w ? 'r' : xr > 1 ? 't' : 'T'), sway)
      p.set(mx - 1, 16, 'W'); p.set(mx, 17, 'A'); p.set(mx, 18, 'W') // collar button line
      hands(p, 31); sandals(p)
      face(p, mx, 9.6, 3.8, 4.6)
      // Shemagh: red check on white, framing the face and falling over the shoulders
      const check = (x, y) => ((x + (y >> 1)) % 3 === 0 ? 'R' : 'W')
      for (let y = 1; y <= 22; y++)
        for (let x = mx - 7; x <= mx + 7; x++) {
          const onHead = inE(x, y, mx, 8.6, 5.9, 7.2) && !inE(x, y, mx, 9.6, 3.8, 4.6)
          const drape = y >= 12 && Math.abs(x - mx) >= 4 && Math.abs(x - mx) <= 6 + (y > 18 && x > mx ? sway : 0) && y <= (x < mx ? 22 : 19)
          if (onHead || drape) p.set(x, y, check(x, y))
        }
      p.span(3, mx, 4, 'A'); p.span(4, mx, 5, 'A') // agal
    },
  },
  // Atlanta night out: long white kurta, black waistcoat with gold edge, his checkered headband
  atlanta: {
    palette: { ...SKIN, ...HAIR, W: '#f4f2ee', w: '#d6d2cb', V: '#1b1a20', G: '#c9a14a', P: '#2c2c35', X: '#1d1b20', O: '#ece8e0', S: '#3a2a20' },
    draw: (p, sway) => {
      body(p, mx, 15, 42, (y) => (y < 16 ? 5 : 7), (x, y, xr, w) => {
        if (y < 36 && Math.abs(xr) >= 2 && Math.abs(xr) <= w - 1) return Math.abs(xr) === 2 ? 'G' : 'V'
        return xr > 1 ? 'w' : 'W'
      })
      body(p, mx, 43, MH - 2, () => 4, (x, y, xr) => (xr === 0 ? 'V' : 'P'))
      p.set(mx - 7, 16, 'W'); p.set(mx + 7, 16, 'w')
      hands(p, 30); sandals(p); manHead(p)
      for (let x = mx - 6; x <= mx + 6; x++) { p.set(x, 4, ((x >> 1) + 4) % 2 ? 'X' : 'O'); p.set(x, 5, ((x >> 1) + 5) % 2 ? 'X' : 'O') }
    },
  },
}

// ═══════════════════════════════════════════════════════ Wife  (26 × 51)
const WW = 26, WH = 51, wx = 13
const dressHW = (y) => (y < 17 ? 6 : y < 26 ? 6.5 : 6.5 + ((y - 26) / 23) * 3.5)

/** Hijab-style head covering: `c(x, y)` colors the scarf; plain face in the opening. */
function hijab(p, c, drapeTo = 20, sway = 0) {
  for (let y = 1; y <= drapeTo; y++)
    for (let x = wx - 8; x <= wx + 8; x++) {
      const head = inE(x, y, wx, 8.5, 5.8, 7.2)
      const drape = y >= 12 && Math.abs(x - wx) <= Math.min(7, 5 + (y - 12) * 0.5) + (y > drapeTo - 3 ? sway : 0)
      if (head || drape) p.set(x, y, c(x, y))
    }
  face(p, wx, 9.8, 3.3, 4.2)
}

const women = {
  // Black thobe with red tatreez, white veil
  palestine: {
    palette: { ...SKIN, D: '#211c26', d: '#3a3142', R: '#d02a3e', q: '#8e1a2c', G: '#e6b450', V: '#f4efe6', v: '#d4cabb', r: '#e8a070' },
    draw: (p, sway) => {
      body(p, wx, 16, WH - 2, dressHW, (x, y, xr, w) => {
        if (xr === -w) return 'r'
        if (y >= 18 && y <= 25 && Math.abs(xr) <= 3) return (Math.abs(xr) + y) % 3 === 0 ? 'R' : xr === 0 ? 'G' : 'D'
        if (y >= 27 && y <= WH - 5 && Math.abs(Math.abs(xr) - 4) <= 0) return y % 2 ? 'R' : 'q'
        if (y >= WH - 4) return (x + y) % 3 === 0 ? 'G' : 'R'
        return xr < -w + 3 ? 'd' : 'D'
      }, sway)
      p.set(wx - 8, 30, 'F'); p.set(wx + 8, 30, 'f')
      hijab(p, (x) => (x > wx + 2 ? 'v' : 'V'), 20, sway)
    },
  },
  // Hajj: black abaya and niqab — fully black, no eyes, just soft fabric folds
  hajj: {
    palette: { K: '#141217', k: '#24212a', l: '#34303b' },
    draw: (p, sway) => {
      body(p, wx, 14, WH - 1, (y) => (y < 17 ? 6 : 6.5 + ((y - 17) / 33) * 3.8), (x, y, xr, w) =>
        xr === -w ? 'l' : (xr + y) % 7 === 0 && y > 20 ? 'k' : xr < -w + 3 ? 'k' : 'K', sway)
      for (let y = 1; y <= 18; y++)
        for (let x = wx - 8; x <= wx + 8; x++) {
          if (!inE(x, y, wx, 8.5, 5.9, 7.4) && !(y >= 12 && Math.abs(x - wx) <= 5 + (y - 12) * 0.5)) continue
          p.set(x, y, x < wx - 3 ? 'k' : inE(x, y, wx - 2, 5, 2, 2) ? 'l' : 'K')
        }
    },
  },
  // Istanbul: belted camel coat, turquoise floral silk scarf
  turkey: {
    palette: { ...SKIN, C: '#c49a6c', c: '#a57c52', B: '#6b4a2e', T: '#2f7fa6', t: '#1f5f80', W: '#f2e6c8', R: '#c0392b', S: '#3a2a20' },
    draw: (p, sway) => {
      body(p, wx, 16, WH - 2, dressHW, (x, y, xr, w) => {
        if (y === 27) return 'B'
        if (xr === 1 && y > 17) return 'c'
        if (y > 17 && y < 26 && xr === -3 && y % 3 === 0) return 'B' // buttons
        return xr > 3 ? 'c' : 'C'
      }, sway)
      p.set(wx - 8, 30, 'F'); p.set(wx + 8, 30, 'f')
      hijab(p, (x, y) => (hash(x, y) < 0.12 ? 'W' : hash(y, x) < 0.08 ? 'R' : x > wx + 2 ? 't' : 'T'), 21, sway)
    },
  },
  // Madinah: black abaya with gold-embroidered sleeves, black shayla
  saudi: {
    palette: { ...SKIN, K: '#141217', k: '#2a2730', G: '#d9a441', g: '#9c6f24' },
    draw: (p, sway) => {
      body(p, wx, 16, WH - 2, dressHW, (x, y, xr, w) => {
        if (y >= 28 && y <= 30 && Math.abs(xr) >= w - 1) return y === 29 ? 'G' : 'g'
        if (xr === 0 && y > 20 && y % 4 === 0) return 'g'
        return xr < -w + 3 ? 'k' : 'K'
      }, sway)
      p.set(wx - 8, 31, 'F'); p.set(wx + 8, 31, 'f')
      hijab(p, (x) => (x < wx - 3 ? 'k' : 'K'), 20, sway)
    },
  },
  // Atlanta night market: dusty-rose hijab, long cream cardigan, a cup of karak chai
  atlanta: {
    palette: { ...SKIN, P: '#c98a8f', p: '#a86d73', C: '#efe6d6', c: '#cfc3ae', M: '#6d4b5e', m: '#553a49', U: '#f7f3ea', u: '#b98a5a', s: '#dcd6cc' },
    draw: (p, sway) => {
      body(p, wx, 16, WH - 2, dressHW, (x, y, xr, w) => {
        if (Math.abs(xr) <= 2) return xr > 0 ? 'm' : 'M' // dress under the open cardigan
        return xr > 3 ? 'c' : 'C'
      }, sway)
      hijab(p, (x) => (x > wx + 2 ? 'p' : 'P'), 20, sway)
      // Cup held in front with both hands, a wisp of steam
      p.rect(wx - 1, 27, wx + 1, 30, 'U'); p.set(wx + 1, 28, 'u'); p.set(wx - 2, 29, 'F'); p.set(wx + 2, 29, 'f')
      p.set(wx - sway, 25, 's'); p.set(wx + 1 - sway, 24, 's')
    },
  },
}

// Sandbox experiment: the same figures at hem sway -1 / 0 / +1, as raw material for lab/alive.py.
for (const [name, o] of Object.entries(men)) {
  const frames = [-1, 0, 1].map((sway) => { const p = new Pix(MW, MH); o.draw(p, sway); return p })
  save(`vien-${name}-sways`, { palette: o.palette, fps: 1, frames })
}
for (const [name, o] of Object.entries(women)) {
  const frames = [-1, 0, 1].map((sway) => { const p = new Pix(WW, WH); o.draw(p, sway); return p })
  save(`wife-${name}-sways`, { palette: o.palette, fps: 1, frames })
}

// ── Wave: the outer arm raised, hand swinging. Four poses per figure: raising, hand left / centre / right.
// He waves with the arm on the viewer's left, she with the one on the right, so neither arm crosses the other.
function line(p, x0, y0, x1, y1, k) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n)
    p.set(x, y, k); p.set(x + 1, y, k)
  }
}
/** side: -1 = viewer's left, +1 = right. sleeve/hand are palette keys; handY = row of the lowered hand to remove. */
function waveArm(p, cx, side, pose, { sleeve, hand, shade = hand, handY, cuff }) {
  if (handY !== undefined) { p.set(cx + side * 8, handY, '.'); p.set(cx + side * 8, handY + 1, '.') }
  const o = side < 0 ? -1 : 0 // lines are 2 px wide to the right, so shift the left arm one column
  const sx = cx + side * 6 + o, sy = 18
  const [ex, ey, hx, hy] = pose === 'mid'
    ? [cx + side * 9 + o, 23, cx + side * 10 + o, 18]
    : [cx + side * 9 + o, 21, cx + side * 9 + o + pose, 11]
  line(p, sx, sy, ex, ey, sleeve)
  line(p, ex, ey, hx, hy, sleeve)
  if (cuff) { p.set(hx, hy + 1, cuff); p.set(hx + 1, hy + 1, cuff) }
  p.rect(hx, hy - 2, hx + 1, hy, (x) => (x === hx ? hand : shade)) // open hand
}
const POSES = ['mid', -1, 0, 1]
const manArm = {
  palestine: { sleeve: 'T', hand: 'F', shade: 'f', handY: 31 },
  hajj: { sleeve: 'F', hand: 'F', shade: 'f', handY: 30 },
  turkey: { sleeve: 'N', hand: 'F', shade: 'f', handY: 31, cuff: 'G' },
  saudi: { sleeve: 'T', hand: 'F', shade: 'f', handY: 31 },
  atlanta: { sleeve: 'W', hand: 'F', shade: 'f', handY: 30 },
}
const womanArm = {
  palestine: { sleeve: 'D', hand: 'F', shade: 'f', handY: 30, cuff: 'R' },
  hajj: { sleeve: 'K', hand: 'l', shade: 'k' },
  turkey: { sleeve: 'C', hand: 'F', shade: 'f', handY: 30 },
  saudi: { sleeve: 'K', hand: 'F', shade: 'f', handY: 31, cuff: 'G' },
  atlanta: { sleeve: 'C', hand: 'F', shade: 'f' },
}
for (const [name, o] of Object.entries(men)) {
  const frames = POSES.map((pose) => { const p = new Pix(MW, MH); o.draw(p, 0); waveArm(p, mx, -1, pose, manArm[name]); return p })
  save(`vien-${name}-wave`, { palette: o.palette, fps: 1, frames })
}
for (const [name, o] of Object.entries(women)) {
  const frames = POSES.map((pose) => { const p = new Pix(WW, WH); o.draw(p, 0); waveArm(p, wx, 1, pose, womanArm[name]); return p })
  save(`wife-${name}-wave`, { palette: o.palette, fps: 1, frames })
}
