#!/usr/bin/env node
// Sandbox experiment: the couple on horseback for the scrolling "journey" scene, one look per stop:
//   aqsa (dawn) · makkah (noon) · madinah (sunset) · istanbul (night)
//   node scripts/art/horses-journey.mjs   ->  assets/characters/rider-him-<stop>.json, rider-her-<stop>.json
// Same horse, seat and walk cycle as horses.mjs (drawn facing left; the scene flips them to ride right).
// Every stop uses the same 68x80 canvas, so the scene can dissolve one look into the next.
// Faces are plain on purpose. In Makkah she wears a fully black niqab.
import { Pix, hash, save } from './lib.mjs'

console.log('Generating journey riders:')

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
    const top = G - 22 - bob, foot = G - lift
    const kneeX = lx + Math.round(swing / 2), kneeY = G - 11
    const hind = lx > 34
    // Upper leg: a muscled forearm / thigh that tapers to the knee (wider behind), shaded on the right
    for (let y = top; y <= kneeY; y++) {
      const t = (y - top) / (kneeY - top)
      const wd = Math.round((hind ? 7 : 5) - (hind ? 3.6 : 2) * t)
      const x0 = Math.round(lx + (kneeX - lx) * t) - Math.floor(wd / 2) + (hind ? Math.round((1 - t) * 1.5) : 0)
      for (let dx = 0; dx < wd; dx++) p.set(x0 + dx, y, far || dx === wd - 1 ? coat(x0 + dx, y, 'underside') : coat(x0 + dx, y, 'leg'))
    }
    // Cannon bone: 3px down to a fetlock and a wider hoof with the toe forward
    for (let y = kneeY; y <= foot; y++) {
      const t = (y - kneeY) / Math.max(1, foot - kneeY)
      const x = Math.round(kneeX + (swing - swing / 2) * t)
      const hoofRow = y >= foot - 1
      p.set(x, y, hoofRow ? hoof : coat(x, y, far ? 'underside' : 'leg'))
      p.set(x + 1, y, hoofRow ? hoof : coat(x + 1, y, far ? 'underside' : 'leg'))
      p.set(x + 2, y, hoofRow ? hoof : coat(x + 2, y, 'underside'))
      if (hoofRow || y === foot - 2) p.set(x - 1, y, hoofRow ? hoof : coat(x - 1, y, far ? 'underside' : 'leg'))
    }
  }
  const by = G - 27 - bob
  // Barrel, chest and hindquarters
  for (let y = by - 10; y <= by + 10; y++)
    for (let x = 10; x <= 60; x++) {
      const inBody = inE(x, y, 34, by, 17, 8.2) || inE(x, y, 21, by - 0.5, 8, 9) || inE(x, y, 47.5, by - 0.5, 8.6, 8.4)
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
  for (let i = 0; i < 19; i++) {
    const x = 56 + Math.round(Math.sin(i * 0.25 + frame * 0.6) * 1.5 + i * 0.2), y = by - 6 + i
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

// ───────────────────────────────────────── horse coats (keys a b c d e f k, m = mane, n = tail)
const COATS = {
  grey: { a: '#c3c8ce', b: '#a8adb3', c: '#7e848c', d: '#5a5f66', e: '#3a3e44', f: '#e2e5e8', k: '#1c1c20', m: '#3a3e44', n: '#5a5f66' },
  white: { a: '#f6f6f2', b: '#e4e4df', c: '#c4c6c8', d: '#b0b2b6', e: '#9a9ca0', f: '#fbfbf8', k: '#3a3a40', m: '#fbfbf8', n: '#e4e4df' },
  bay: { a: '#9a5a2e', b: '#874c26', c: '#6b3a1e', d: '#4a2a18', e: '#24160e', f: '#a8683a', k: '#141014', m: '#1c1410', n: '#1c1410' },
  chestnut: { a: '#b5652a', b: '#a05624', c: '#7e421c', d: '#5e3014', e: '#3e200e', f: '#c8783a', k: '#1c1410', m: '#8a4a1e', n: '#8a4a1e' },
  black: { a: '#2e2c30', b: '#262428', c: '#1c1a1e', d: '#18161a', e: '#0c0a0e', f: '#3a383e', k: '#08080a', m: '#141216', n: '#141216' },
  palomino: { a: '#e0b870', b: '#cfa55e', c: '#a8824a', d: '#8e6c3c', e: '#6a4e2a', f: '#ecc888', k: '#2a2018', m: '#f6efdc', n: '#f2ead8' },
}
const TACK = { s: '#2b1d12', S: '#8a3a2e', B: '#6a3a44' }
const SKIN = { F: '#e2b793', g: '#c8997a', h: '#1a1616' }

function coatFn(style) {
  return (x, y, part) => {
    if (part === 'head') return style === 'dapple' ? ((x + y) % 5 === 0 ? 'e' : 'd') : x < 7 ? 'b' : 'a'
    if (part === 'underside') return 'c'
    if (part === 'leg') return y > G - 5 ? (style === 'dapple' ? 'd' : 'c') : 'b'
    if (style !== 'dapple') return y > G - 26 && x > 40 ? 'b' : 'a'
    const n = hash(x >> 1, y >> 1)
    return n < 0.18 ? 'c' : n < 0.3 ? 'f' : x < 30 ? 'a' : 'b'
  }
}

/**
 * Him. Keys: J j = robe/jacket (lit / shaded), Y W = ornament, P p = leg, K = boot, R r = headwear, Q = its pattern, A = agal.
 * head: 'wrap' (tied cloth) | 'hair' | 'scarf' (keffiyeh / shemagh with an agal, falling down the back)
 */
function him({ coat, style = 'plain', mane = 'short', head, ornament = false, palette }) {
  const pal = { ...COATS[coat], ...TACK, ...SKIN, ...palette }
  const frames = [0, 1, 2, 3].map((frame) => {
    const p = new Pix(W, H)
    const by = horse(p, { coat: coatFn(style), mane, maneKey: 'm', tailKey: 'n', hoof: 'k', frame })
    outline(p, 'e')
    const seat = by - 10
    // Saddle, blanket and reins first, so the rider's leg and skirt lie over them
    tack(p, by, [24, seat - 5], 's', 'S', 'B')
    // Torso: square shoulders tapering to the waist, lit from the left; a chest fold under the arm
    for (let y = seat - 15; y <= seat; y++) {
      const t = (y - (seat - 15)) / 15
      const front = y < seat - 13 ? 32 : Math.round(31 + t * 1.6), back = y < seat - 13 ? 38 : Math.round(39.4 - t * 1.6)
      for (let x = front; x <= back; x++) {
        let k = x >= back - 1 ? 'j' : 'J'
        if (ornament) {
          const dy = y - (seat - 8), dx = x - 35
          if (Math.abs(dx) + Math.abs(dy) === 3) k = 'Y'
          else if (Math.abs(dx) + Math.abs(dy) === 1) k = 'W'
          if (x === front && y > seat - 12) k = 'Y'
        }
        p.set(x, y, k)
      }
    }
    p.set(31, seat - 13, 'J'); p.set(39, seat - 13, 'j') // shoulder caps
    // Thigh lying forward over the saddle, knee, shin and a boot with the toe forward in the stirrup
    capsule(p, 36, seat, 31, by - 4, 2.4, 2.1, 'P')
    capsule(p, 31, by - 4, 32, by + 4, 2, 1.5, (x) => (x >= 33 ? 'p' : 'P'))
    p.rect(30, by + 5, 33, by + 7, 'K'); p.set(29, by + 7, 'K'); p.set(28, by + 7, 'K'); p.set(29, by + 6, 'K')
    p.rect(27, by + 8, 34, by + 8, 's'); p.set(34, by + 5, 's'); p.set(34, by + 6, 's'); p.set(34, by + 7, 's') // stirrup
    // Arm: upper arm down from the shoulder, elbow, forearm forward to the reins
    capsule(p, 33, seat - 12, 31, seat - 7, 1.6, 1.4, (x) => (x >= 32 ? 'j' : 'J'))
    capsule(p, 31, seat - 7, 26, seat - 5, 1.3, 1.1, (x, y) => (y >= seat - 5 ? 'j' : 'J'))
    p.set(25, seat - 6, 'F'); p.set(24, seat - 6, 'F'); p.set(24, seat - 5, 'g')
    for (let y = seat - 24; y <= seat - 16; y++) for (let x = 31; x <= 38; x++) if (inE(x, y, 34.5, seat - 20, 3.6, 4.4)) p.set(x, y, x > 36 ? 'g' : 'F')
    for (let y = seat - 16; y <= seat - 15; y++) { p.set(34, y, 'F'); p.set(35, y, 'g') }
    if (head === 'wrap') {
      for (let x = 31; x <= 38; x++) { p.set(x, seat - 25, 'R'); p.set(x, seat - 24, x > 36 ? 'r' : 'R') }
      p.set(30, seat - 23, 'R'); p.set(39, seat - 24, 'r'); p.set(40, seat - 23, 'r'); p.set(40, seat - 22, 'R')
      p.set(31, seat - 22, 'h'); p.set(38, seat - 21, 'h'); p.set(38, seat - 20, 'h')
    } else if (head === 'hair') {
      for (let x = 31; x <= 38; x++) { p.set(x, seat - 25, 'h'); p.set(x, seat - 24, 'h') }
      for (let y = seat - 23; y <= seat - 19; y++) { p.set(38, y, 'h'); p.set(39, y, 'h') }
      p.set(31, seat - 23, 'h'); p.set(32, seat - 26, 'h'); p.set(35, seat - 26, 'h'); p.set(37, seat - 26, 'h')
    } else {
      // Cloth over the crown and down the back of the neck (the back is to the right), agal on top
      const net = (x, y) => ((x + y) % 2 === 0 ? 'Q' : 'R')
      for (let x = 31; x <= 39; x++) { p.set(x, seat - 26, net(x, 0)); p.set(x, seat - 24, net(x, 0)) }
      for (let y = seat - 23; y <= seat - 11; y++) {
        const sway = frame % 2 && y > seat - 15 ? 1 : 0
        for (let x = 37; x <= (y > seat - 19 ? 41 : 40); x++) p.set(x + sway, y, x === 37 && y < seat - 17 ? 'r' : net(x, y))
      }
      p.set(31, seat - 23, 'R'); p.set(30, seat - 22, 'R')
      for (let x = 30; x <= 40; x++) p.set(x, seat - 25, 'A')
    }
    return p
  })
  return { palette: pal, fps: 4, frames }
}

/**
 * Her. Keys: V v = head covering, R = vest/bodice, X = trim, L l = sleeves, D E = skirt, O w = shoe/sock,
 * U u = plume. cap: the red takiya with a plume. niqab: the face is covered (fully black in Makkah).
 */
function her({ coat, style = 'plain', mane = 'long', cap = false, niqab = false, palette }) {
  const pal = { ...COATS[coat], ...TACK, F: '#ecbfa2', g: '#d4a386', ...palette }
  const frames = [0, 1, 2, 3].map((frame) => {
    const p = new Pix(W, H)
    const by = horse(p, { coat: coatFn(style), mane, maneKey: 'm', tailKey: 'n', hoof: 'k', frame })
    outline(p, 'e')
    const seat = by - 10
    // Saddle, blanket and reins first, so the rider's leg and skirt lie over them
    tack(p, by, [22, seat - 3], 's', 'S', 'B')
    // Skirt draped over the horse's side: fuller toward the hem, with folds and a shaded back edge
    for (let y = seat - 1; y <= by + 5; y++) {
      const hw = 3 + Math.round((y - seat) * 0.5)
      for (let x = 37 - hw; x <= 37 + hw; x++) p.set(x, y, x >= 37 + hw - 1 || (x - y) % 4 === 0 ? 'E' : 'D')
    }
    for (let x = 29; x <= 46; x++) if ((x + frame) % 2 === 0) p.set(x, by + 6, 'E')
    p.set(36, by + 7, 'w'); p.set(36, by + 8, 'O'); p.set(35, by + 8, 'O'); p.set(34, by + 8, 'O')
    p.rect(33, by + 9, 38, by + 9, 's')
    // Bodice leaning forward a little: shoulders, a narrower waist, trim down the front and at the belt
    for (let y = seat - 14; y <= seat; y++) {
      const lean = Math.round((seat - y) * 0.2)
      const t = (y - (seat - 14)) / 14
      const front = Math.round(33.4 + t * 1.2) - lean, back = Math.round(40.6 - t * 1.4) - lean
      for (let x = front; x <= back; x++) {
        let k = x >= back - 1 ? 'l' : 'R'
        if (x === front + 2 || y === seat) k = 'X'
        p.set(x, y, k)
      }
    }
    // Sleeve: upper arm, elbow, forearm reaching to the horse's neck
    capsule(p, 34, seat - 11, 31, seat - 6, 1.7, 1.4, (x) => (x >= 33 ? 'l' : 'L'))
    capsule(p, 31, seat - 6, 25, seat - 4, 1.3, 1.1, (x, y) => (y >= seat - 4 ? 'l' : 'L'))
    const hand = niqab ? 'l' : 'F'
    p.set(23, seat - 4, hand); p.set(24, seat - 4, hand); p.set(22, seat - 3, hand)
    const hx = 35.5, hy = seat - 19
    for (let y = hy - 6; y <= hy + 7; y++)
      for (let x = 29; x <= 42; x++) {
        if (!niqab && inE(x, y, hx, hy, 3.3, 4.2)) p.set(x, y, x > hx + 1.5 ? 'g' : 'F')
        else if (inE(x, y, hx + 0.3, hy + 0.8, 5.3, 6.3)) p.set(x, y, x > hx + 2 ? 'v' : 'V')
      }
    if (cap) {
      for (let y = hy - 8; y <= hy - 5; y++) for (let x = 31; x <= 40; x++) p.set(x, y, (x + y) % 3 === 0 ? 'X' : y === hy - 5 ? 'r' : 'C')
      for (let i = 0; i < 6; i++) {
        const sway = frame % 2 && i > 3 ? 1 : 0
        p.set(35 + sway, hy - 9 - i, 'U'); p.set(34 - Math.round(i / 2) + sway, hy - 9 - i, i > 1 ? 'u' : 'U'); p.set(36 + Math.round(i / 2) + sway, hy - 9 - i, i > 1 ? 'u' : 'U')
      }
    } else {
      // The scarf's tail lifts a little in the wind behind her
      const sway = frame % 2 ? 1 : 0
      for (let i = 0; i < 4; i++) p.set(41 + i, hy + 2 + Math.round(i * 0.6) - sway, 'v')
    }
    return p
  })
  return { palette: pal, fps: 4, frames }
}

const WHITE = { J: '#f3eee4', j: '#cfc5b6' }
const STOPS = {
  // Al-Aqsa at dawn: white thobe, black-and-white keffiyeh; black thobe with red tatreez, white veil
  aqsa: {
    him: { coat: 'grey', style: 'dapple', head: 'scarf', palette: { ...WHITE, P: '#f3eee4', p: '#cfc5b6', K: '#5a3b28', R: '#efe9dc', r: '#cfc5b6', Q: '#26222b', A: '#141117' } },
    her: { coat: 'white', palette: { V: '#f4efe6', v: '#d4cabb', R: '#d02a3e', X: '#e6b450', L: '#211c26', l: '#3a3142', D: '#211c26', E: '#8e1a2c', O: '#1a1a20', w: '#211c26' } },
  },
  // Makkah at noon: plain white, bare head; black abaya and niqab
  makkah: {
    him: { coat: 'chestnut', head: 'hair', palette: { J: '#f8f7f3', j: '#dedbd3', P: '#f8f7f3', p: '#dedbd3', K: '#6b4a33' } },
    her: { coat: 'palomino', niqab: true, palette: { V: '#141217', v: '#24212a', R: '#141217', X: '#24212a', L: '#141217', l: '#34303b', D: '#141217', E: '#24212a', O: '#0c0a0e', w: '#141217' } },
  },
  // Madinah at sunset: white thobe, red-and-white shemagh; black abaya with gold trim
  madinah: {
    him: { coat: 'black', head: 'scarf', palette: { J: '#f7f5ef', j: '#d8d3c8', P: '#f7f5ef', p: '#d8d3c8', K: '#6b4a33', R: '#f2ede4', r: '#d8d3c8', Q: '#c8323a', A: '#141117' } },
    her: { coat: 'bay', palette: { V: '#141217', v: '#2a2730', R: '#141217', X: '#d9a441', L: '#141217', l: '#2a2730', D: '#141217', E: '#2a2730', O: '#0c0a0e', w: '#141217' } },
  },
  // Istanbul at night: navy kaftan with gold; camel coat, turquoise scarf
  istanbul: {
    him: { coat: 'palomino', head: 'hair', ornament: true, palette: { J: '#26335c', j: '#1a2342', Y: '#d9a441', W: '#f1ece2', P: '#1c2240', p: '#12162a', K: '#141217' } },
    her: { coat: 'chestnut', palette: { V: '#2f7fa6', v: '#1f5f80', R: '#c49a6c', X: '#6b4a2e', L: '#c49a6c', l: '#a57c52', D: '#c49a6c', E: '#a57c52', O: '#3a2a20', w: '#f2e6c8' } },
  },
}

for (const [stop, o] of Object.entries(STOPS)) {
  save(`rider-him-${stop}`, him(o.him))
  save(`rider-her-${stop}`, her(o.her))
}
