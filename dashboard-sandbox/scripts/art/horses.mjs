#!/usr/bin/env node
// Generates the couple on horseback for the Kazakh mountain-meadow scene:
//   vien-horse-kazakh  — dappled grey horse, Vien in a dark velvet jacket with gold/silver ornament
//   wife-horse-kazakh  — white horse, his wife in a red embroidered vest, white frilled dress,
//                        white hijab under a red takiya with a white feather plume
//   node scripts/art/horses.mjs
// Faces are plain on purpose. Horses face left and walk (4-frame leg cycle).
import { Pix, hash, save } from './lib.mjs'

console.log('Generating riders:')

const W = 68, H = 80
const G = H - 1 // ground row

const inE = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

/** Filled capsule from (x0,y0) to (x1,y1) with radius r0 → r1. */
function capsule(p, x0, y0, x1, y1, r0, r1, key) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2)
  for (let i = 0; i <= n; i++) {
    const t = i / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t, r = r0 + (r1 - r0) * t
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) <= r) p.set(x, y, typeof key === 'function' ? key(x, y) : key)
  }
}

/**
 * Draw a horse facing left. `coat(x, y, part)` returns the palette key for a body pixel, where part is
 * 'body' | 'head' | 'leg' | 'underside'. `frame` 0–3 drives the walk cycle.
 */
function horse(p, { coat, mane, maneKey, tailKey, hoof, frame }) {
  const bob = frame % 2 ? 1 : 0 // body rises a pixel mid-stride
  // Legs: [hip x, phase offset]; far legs drawn darker first
  const legs = [[22, 0.5, true], [47, 0, true], [18, 0, false], [43, 0.5, false]]
  for (const [lx, off, far] of legs) {
    const ph = ((frame / 4 + off) % 1) * Math.PI * 2
    const swing = Math.round(Math.sin(ph) * 3)
    const lift = Math.max(0, Math.round(Math.cos(ph) * 2))
    const top = G - 17 - bob, foot = G - lift
    const kneeX = lx + Math.round(swing / 2), kneeY = G - 9
    // Upper leg: 3px, shaded on the right; lower leg: 2px down to the hoof
    for (let y = top; y <= kneeY; y++) {
      const t = (y - top) / (kneeY - top)
      const x0 = Math.round(lx + (kneeX - lx) * t) - 1
      for (let dx = 0; dx < 3; dx++) p.set(x0 + dx, y, far || dx === 2 ? coat(x0 + dx, y, 'underside') : coat(x0 + dx, y, 'leg'))
    }
    for (let y = kneeY; y <= foot; y++) {
      const t = (y - kneeY) / Math.max(1, foot - kneeY)
      const x = Math.round(kneeX + (swing - swing / 2) * t)
      const hoofRow = y >= foot - 1
      p.set(x, y, hoofRow ? hoof : coat(x, y, far ? 'underside' : 'leg'))
      p.set(x + 1, y, hoofRow ? hoof : coat(x + 1, y, 'underside'))
    }
  }
  const by = G - 22 - bob
  // Barrel, chest and hindquarters
  for (let y = by - 10; y <= by + 10; y++)
    for (let x = 10; x <= 60; x++) {
      const inBody = inE(x, y, 34, by, 17, 8.5) || inE(x, y, 21, by - 1, 7.5, 8.5) || inE(x, y, 49, by - 1, 9.5, 9)
      if (!inBody) continue
      p.set(x, y, coat(x, y, y > by + 5 ? 'underside' : 'body'))
    }
  // Neck and lowered head (like a horse walking relaxed)
  capsule(p, 22, by - 5, 11, by - 17, 5, 3.6, (x, y) => coat(x, y, 'body'))
  capsule(p, 10, by - 18, 4, by - 7, 3.4, 2.3, (x, y) => coat(x, y, 'head'))
  p.set(10, by - 22, coat(10, by - 22, 'head')); p.set(12, by - 22, coat(12, by - 22, 'head')) // ears
  p.set(11, by - 21, coat(11, by - 21, 'head'))
  // Mane along the top of the neck, falling to the right side
  for (let i = 0; i <= 12; i++) {
    const x = 11 + Math.round(i * 0.95), y = by - 20 + Math.round(i * 1.05)
    for (let k = 0; k < (mane === 'long' ? 3 : 2); k++) p.set(x + k, y - 1 + (frame % 2 && k === 2 ? 1 : 0), maneKey)
  }
  // Tail
  for (let i = 0; i < 16; i++) {
    const x = 59 + Math.round(Math.sin(i * 0.25 + frame * 0.6) * 1.5 + i * 0.2), y = by - 6 + i
    p.set(x, y, tailKey); p.set(x + 1, y, tailKey)
    if (i > 5) p.set(x - 1, y, tailKey)
  }
  return by
}

/** Pixel-art outline: every drawn pixel that touches empty space gets the outline color. */
function outline(p, key) {
  const edge = []
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++)
      if (p.get(x, y) !== '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => p.get(x + dx, y + dy) === '.')) edge.push([x, y])
  for (const [x, y] of edge) p.set(x, y, key)
}

/** Bridle on the head and a rein running back to the rider's hands. */
function tack(p, by, hands, strap, saddle, blanket) {
  for (let i = 0; i < 6; i++) p.set(8 - Math.round(i * 0.3), by - 16 + i * 2, strap) // cheek strap
  p.set(5, by - 9, strap); p.set(6, by - 9, strap); p.set(7, by - 9, strap) // noseband
  const [hx, hy] = hands
  const n = Math.max(Math.abs(hx - 6), Math.abs(hy - (by - 9)))
  for (let i = 0; i <= n; i++) p.set(Math.round(6 + ((hx - 6) * i) / n), Math.round(by - 9 + ((hy - by + 9) * i) / n + Math.sin((i / n) * Math.PI) * 2), strap)
  // Saddle blanket and saddle on the back
  for (let x = 28; x <= 42; x++) for (let y = by - 9; y <= by - 3; y++) p.set(x, y, y === by - 3 || x === 28 || x === 42 ? strap : blanket)
  for (let x = 30; x <= 40; x++) p.set(x, by - 10, saddle)
  p.set(29, by - 11, saddle); p.set(41, by - 11, saddle)
}

// ───────────────────────────────────────── Vien on the dappled grey
{
  const palette = {
    a: '#c3c8ce', b: '#a8adb3', c: '#7e848c', d: '#5a5f66', e: '#3a3e44', f: '#e2e5e8', k: '#1c1c20', // horse
    s: '#2b1d12', S: '#8a3a2e', B: '#6a3a44', // tack, saddle, blanket
    F: '#e2b793', g: '#c8997a', h: '#1a1616', // skin, hair
    J: '#2a1a24', j: '#3f2836', Y: '#d9a441', W: '#cfd3d8', P: '#23232b', K: '#141217', // jacket, ornament, pants, boots
    R: '#8a5a2e', r: '#6b4424', // brown head wrap
  }
  const frames = [0, 1, 2, 3].map((frame) => {
    const p = new Pix(W, H)
    const coat = (x, y, part) => {
      if (part === 'head') return (x + y) % 5 === 0 ? 'e' : 'd'
      if (part === 'underside') return 'c'
      if (part === 'leg') return y > G - 5 ? 'd' : 'b'
      const n = hash(x >> 1, y >> 1)
      return n < 0.18 ? 'c' : n < 0.3 ? 'f' : x < 30 ? 'a' : 'b' // dapples
    }
    const by = horse(p, { coat, mane: 'short', maneKey: 'e', tailKey: 'd', hoof: 'k', frame })
    outline(p, 'e')
    // Rider: seated upright, leg down the horse's side, hands forward on the reins
    const seat = by - 10
    for (let y = seat - 1; y <= by + 2; y++) for (let x = 33; x <= 36; x++) p.set(x, y, 'P') // thigh + lower leg
    for (let y = by + 3; y <= by + 5; y++) { p.set(33, y, 'K'); p.set(34, y, 'K'); p.set(35, y, 'K') } // boot
    for (let y = seat - 15; y <= seat; y++) {
      const hw = y < seat - 13 ? 3 : 4
      for (let x = 35 - hw; x <= 35 + hw; x++) {
        let k = x < 33 ? 'j' : 'J'
        // Diamond ornament on the chest, gold edging, silver studs
        const dy = y - (seat - 8), dx = x - 34
        if (Math.abs(dx) + Math.abs(dy) === 3) k = 'Y'
        else if (Math.abs(dx) + Math.abs(dy) === 1) k = 'W'
        if (x === 35 - hw && y > seat - 12) k = 'Y'
        p.set(x, y, k)
      }
    }
    for (let i = 0; i < 6; i++) { p.set(31 - i, seat - 9 + Math.round(i * 0.5), 'J'); p.set(30 - i, seat - 9 + Math.round(i * 0.5), 'j') } // arm
    p.set(25, seat - 6, 'F'); p.set(24, seat - 6, 'F') // hands
    // Head: plain face, black hair at the sides, brown head wrap tied at the back
    for (let y = seat - 24; y <= seat - 16; y++) for (let x = 31; x <= 38; x++) if (inE(x, y, 34.5, seat - 20, 3.6, 4.4)) p.set(x, y, x > 36 ? 'g' : 'F')
    for (let x = 31; x <= 38; x++) { p.set(x, seat - 25, 'R'); p.set(x, seat - 24, x > 36 ? 'r' : 'R') }
    p.set(30, seat - 23, 'R'); p.set(39, seat - 24, 'r'); p.set(40, seat - 23, 'r'); p.set(40, seat - 22, 'R') // knot
    p.set(31, seat - 22, 'h'); p.set(38, seat - 21, 'h'); p.set(38, seat - 20, 'h')
    for (let y = seat - 16; y <= seat - 15; y++) p.set(34, y, 'g') // neck
    tack(p, by, [24, seat - 5], 's', 'S', 'B')
    return p
  })
  save('vien-horse-kazakh', { palette, fps: 4, frames })
}

// ───────────────────────────────────────── His wife on the white horse
{
  const palette = {
    a: '#f6f6f2', b: '#e4e4df', c: '#c4c6c8', d: '#9a9ca0', m: '#fbfbf8', k: '#3a3a40', // horse
    s: '#2b1d12', S: '#6b3a26', B: '#4a3a5a',
    F: '#ecbfa2', g: '#d4a386',
    V: '#f7f5f0', v: '#dedad2', // white hijab
    R: '#c8283a', r: '#94192a', X: '#e6e6ec', U: '#ffffff', u: '#e8e4dc', // red takiya, silver, feather plume
    L: '#f6f4ef', l: '#d8d4cc', // white blouse / frilled skirt
    O: '#1a1a20', w: '#ffffff', // shoes, socks
  }
  const frames = [0, 1, 2, 3].map((frame) => {
    const p = new Pix(W, H)
    const coat = (x, y, part) => {
      if (part === 'head') return x < 7 ? 'b' : 'a'
      if (part === 'underside') return 'c'
      if (part === 'leg') return y > G - 5 ? 'c' : 'b'
      return y > G - 26 && x > 40 ? 'b' : 'a'
    }
    const by = horse(p, { coat, mane: 'long', maneKey: 'm', tailKey: 'b', hoof: 'k', frame })
    outline(p, 'd')
    const seat = by - 10
    // Frilled white skirt draped over the horse's side, sock and shoe below
    for (let y = seat - 1; y <= by + 3; y++) {
      const hw = 3 + Math.round((y - seat) * 0.45)
      for (let x = 37 - hw; x <= 37 + hw; x++) p.set(x, y, (y - seat) % 3 === 2 ? 'l' : x > 37 + hw - 2 ? 'l' : 'L')
    }
    for (let x = 30; x <= 45; x++) if ((x + frame) % 2 === 0) p.set(x, by + 4, 'l') // frill edge
    p.set(38, by + 5, 'w'); p.set(38, by + 6, 'w'); p.set(38, by + 7, 'O'); p.set(39, by + 7, 'O')
    // Leaning forward a little: white blouse, red embroidered vest with silver trim
    for (let y = seat - 14; y <= seat; y++) {
      const lean = Math.round((seat - y) * 0.2)
      for (let x = 34 - lean; x <= 40 - lean; x++) {
        let k = x <= 35 - lean ? 'L' : 'R'
        if (x === 36 - lean || y === seat) k = 'X'
        p.set(x, y, k)
      }
    }
    // Arms reaching to rest both hands on the horse's neck
    for (let i = 0; i < 9; i++) { p.set(33 - i, seat - 9 + Math.round(i * 0.55), 'L'); p.set(32 - i, seat - 8 + Math.round(i * 0.55), 'l') }
    p.set(23, seat - 4, 'F'); p.set(24, seat - 4, 'F'); p.set(22, seat - 3, 'F')
    // Head: white hijab around a plain face, red takiya cap with silver studs and a feather plume
    const hx = 35.5, hy = seat - 19
    for (let y = hy - 6; y <= hy + 7; y++)
      for (let x = 29; x <= 42; x++) {
        if (inE(x, y, hx, hy, 3.3, 4.2)) p.set(x, y, x > hx + 1.5 ? 'g' : 'F')
        else if (inE(x, y, hx + 0.3, hy + 0.8, 5.3, 6.3)) p.set(x, y, x > hx + 2 ? 'v' : 'V')
      }
    for (let y = hy - 8; y <= hy - 5; y++) for (let x = 31; x <= 40; x++) p.set(x, y, (x + y) % 3 === 0 ? 'X' : y === hy - 5 ? 'r' : 'R')
    for (let i = 0; i < 6; i++) { // feather plume
      const sway = frame % 2 && i > 3 ? 1 : 0
      p.set(35 + sway, hy - 9 - i, 'U'); p.set(34 - Math.round(i / 2) + sway, hy - 9 - i, i > 1 ? 'u' : 'U'); p.set(36 + Math.round(i / 2) + sway, hy - 9 - i, i > 1 ? 'u' : 'U')
    }
    tack(p, by, [22, seat - 3], 's', 'S', 'B')
    return p
  })
  save('wife-horse-kazakh', { palette, fps: 4, frames })
}
