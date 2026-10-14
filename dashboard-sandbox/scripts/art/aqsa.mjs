#!/usr/bin/env node
// Generates the "Al-Aqsa at sunset" pixel-art assets into assets/characters/.
//   node scripts/art/aqsa.mjs
// Light comes from the low sun on the left, so left sides are lit and right sides are in shadow.
import { Pix, bayer, hash, save, shade } from './lib.mjs'

console.log('Generating Al-Aqsa sunset assets:')

// ───────────────────────────────────────────────────────── Dome of the Rock
{
  const W = 57, H = 48, cx = 28
  const palette = {
    H: '#fff4c4', G: '#ffd44a', g: '#e9a92a', o: '#b8741a', O: '#7a4516', // gold dome
    B: '#4b9be0', b: '#2a6fb8', d: '#1d4f8a', D: '#12305c', c: '#8fd3ef', // blue tiles
    w: '#f3ecdc', k: '#0d1a33', a: '#ffb55a', y: '#f0c060', // trim, openings, warm light
    m: '#f1e3cf', n: '#cdb9a4', M: '#b39c8a', // marble
    l: '#9aa3b5', L: '#6e7890', s: '#d9a57a', S: '#a8735f', // lead roof, stone
  }
  const p = new Pix(W, H)

  // Finial: upward crescent on a gold pole
  p.set(cx - 1, 0, 'G'); p.set(cx + 1, 0, 'g')
  p.set(cx - 1, 1, 'G'); p.set(cx, 1, 'g'); p.set(cx + 1, 1, 'o')
  for (let y = 2; y <= 3; y++) p.set(cx, y, 'g')
  p.span(4, cx, 1, 'g'); p.set(cx - 1, 4, 'G')

  // Golden dome, slightly pointed
  const R = 13, top = 5, rows = 15
  for (let y = top; y < top + rows; y++) {
    const t = (y - top + 1) / rows
    const hw = Math.round(R * Math.pow(1 - Math.pow(1 - t, 2), 0.8))
    for (let x = cx - hw; x <= cx + hw; x++) {
      const u = (x - cx) / (hw + 0.5)
      const light = 0.55 - u * 0.45 + (1 - t) * 0.15
      p.set(x, y, shade(['O', 'o', 'g', 'G', 'H'], light, x, y, 0.2))
    }
  }
  p.span(20, cx, 14, (x) => (x < cx - 4 ? 'g' : x > cx + 7 ? 'O' : 'o')) // rim

  // Drum: tile band with a row of little windows
  for (let y = 21; y <= 27; y++)
    for (let x = cx - 14; x <= cx + 14; x++) {
      const u = (x - cx) / 14
      let k = (x + y) % 3 === 0 ? 'c' : u < -0.5 ? 'B' : u > 0.5 ? 'd' : 'b'
      if (y === 21 || y === 27) k = 'D'
      else if (y === 22) k = u > 0.6 ? 'n' : 'w'
      else if (y >= 23 && (x - cx) % 4 === 0 && Math.abs(x - cx) <= 12) k = 'k'
      p.set(x, y, k)
    }

  // Roof slope and white parapet
  p.span(28, cx, 20, (x) => (x > cx + 10 ? 'L' : 'l'))
  p.span(29, cx, 25, (x) => (x > cx + 12 ? 'L' : 'l'))
  p.span(30, cx, 28, (x) => (x > cx + 17 ? 'n' : 'w'))

  // Octagonal walls: three visible faces (left lit, center, right in shadow)
  const face = (x) => (x - cx < -16 ? 'left' : x - cx > 16 ? 'right' : 'center')
  const tile = { left: ['B', 'c'], center: ['b', 'c'], right: ['d', 'b'] }
  const marble = { left: 'm', center: 'm', right: 'M' }
  const windows = [-23, -12, -6, 6, 12, 23]
  for (let y = 31; y <= 45; y++)
    for (let x = cx - 28; x <= cx + 28; x++) {
      const xr = x - cx, f = face(x)
      let k
      if (y === 31) k = 'D'
      else if (y <= 33) k = hash(x, y) < 0.42 ? 'w' : 'D' // band of inscription
      else if (y === 34) k = 'D'
      else if (y <= 40) {
        const [base, accent] = tile[f]
        k = (x + y) % 4 === 0 || (((x - y) % 4) + 4) % 4 === 0 ? accent : base
        for (const wx of windows) {
          const dx = Math.abs(xr - wx)
          if (y === 35 && dx === 0) k = 'k'
          else if (y > 35 && dx <= 1) k = y === 40 && dx === 0 ? 'a' : 'k'
          else if (y >= 35 && dx === 2) k = f === 'right' ? 'n' : 'w'
        }
      } else if (y === 41) k = f === 'right' ? 'n' : 'w'
      else k = xr % 4 === 0 ? 'n' : marble[f]
      if (Math.abs(xr) === 17) k = y <= 40 ? 'D' : 'n' // corners between faces
      p.set(x, y, k)
    }

  // Entrance porch with warm light inside
  for (let y = 34; y <= 45; y++)
    for (let xr = -3; xr <= 3; xr++) {
      let k = Math.abs(xr) === 3 ? 'w' : 'k'
      if (y === 34) k = 'w'
      else if (y === 35) k = Math.abs(xr) === 3 ? 'w' : 'y'
      else if (y === 36 && Math.abs(xr) === 2) k = 'y'
      else if (y >= 42 && Math.abs(xr) <= 1) k = 'a'
      p.set(cx + xr, y, k)
    }

  // Platform steps
  p.span(46, cx, 29, (x) => (x > cx + 18 ? 'S' : 's'))
  p.span(47, cx, 30, 'S')

  save('dome-of-the-rock', { palette, frames: [p] })
}

// ───────────────────────────────────────────────────────── Al-Aqsa (Qibli) Mosque
{
  const W = 47, H = 34, cx = 23
  const palette = {
    H: '#e6eaf2', l: '#b9c1cf', L: '#8b94a8', x: '#5d6479', // lead dome
    w: '#f6e2c4', s: '#e8b98a', S: '#c98f6b', t: '#9a6558', // stone
    k: '#2a1726', a: '#ffb55a', g: '#e9a92a', G: '#ffd44a',
  }
  const p = new Pix(W, H)

  p.set(cx - 1, 0, 'G'); p.set(cx + 1, 0, 'g')
  p.set(cx - 1, 1, 'G'); p.set(cx, 1, 'g'); p.set(cx + 1, 1, 'g')
  p.set(cx, 2, 'g'); p.set(cx, 3, 'g')

  // Silver-grey lead dome
  const R = 9, top = 4, rows = 9
  for (let y = top; y < top + rows; y++) {
    const t = (y - top + 1) / rows
    const hw = Math.round(R * Math.pow(1 - Math.pow(1 - t, 2), 0.6))
    for (let x = cx - hw; x <= cx + hw; x++) {
      const u = (x - cx) / (hw + 0.5)
      p.set(x, y, shade(['x', 'L', 'l', 'H'], 0.55 - u * 0.5 + (1 - t) * 0.1, x, y, 0.2))
    }
  }
  // Drum with small windows
  for (let y = 13; y <= 16; y++)
    p.span(y, cx, 10, (x) => (y >= 14 && y <= 15 && (x - cx) % 3 === 0 ? 'k' : x > cx + 5 ? 'S' : 's'))
  p.span(17, cx, 22, 'x') // nave roof behind the facade

  // Facade: crenellations, upper wall, central gable, seven arches
  for (let x = cx - 22; x <= cx + 22; x++) {
    if ((x - cx) % 2 === 0) p.set(x, 18, x > cx + 14 ? 'S' : 's')
    p.set(x, 19, x > cx + 14 ? 'S' : 's')
    p.set(x, 20, 'S')
  }
  for (let y = 21; y <= 23; y++)
    p.span(y, cx, 22, (x) => (y === 22 && [-18, -12, 12, 18].includes(x - cx) ? 'k' : x > cx + 14 ? 'S' : 's'))
  p.span(24, cx, 22, (x) => (x > cx + 14 ? 's' : 'w'))
  for (let r = 0; r <= 3; r++) p.span(20 + r, cx, r, r === 3 ? 'w' : 's') // gable
  p.set(cx, 21, 'k')

  const arches = [-18, -12, -6, 0, 6, 12, 18]
  for (let y = 25; y <= 32; y++)
    for (let x = cx - 22; x <= cx + 22; x++) {
      const xr = x - cx
      let k = xr > 14 ? 'S' : 's'
      if (xr % 6 === 3 || xr % 6 === -3) k = xr > 14 ? 't' : 'S' // pilasters
      for (const ax of arches) {
        const half = ax === 0 ? 2 : 1
        const dx = Math.abs(xr - ax)
        const open = y === 25 ? dx === 0 : y === 26 ? dx <= half - 1 || (half === 1 && dx === 0) : dx <= half
        if (open) k = ax === 0 && y >= 29 && dx <= 1 ? 'a' : 'k'
      }
      p.set(x, y, k)
    }
  p.span(33, cx, 23, 't')

  save('al-aqsa', { palette, frames: [p] })
}

// ───────────────────────────────────────────────────────── Square minaret with lanterns
{
  const W = 13, H = 58, cx = 6
  const palette = {
    w: '#f6e2c4', s: '#e8b98a', S: '#c98f6b', t: '#9a6558', k: '#2a1726',
    l: '#b9c1cf', L: '#8b94a8', g: '#e9a92a', G: '#ffd44a', c: '#4a2c2a', a: '#ffcf6e', A: '#fff1b0',
  }
  const frame = (flicker) => {
    const p = new Pix(W, H)
    p.set(cx - 1, 0, 'G'); p.set(cx + 1, 0, 'g'); p.span(1, cx, 1, 'g'); p.set(cx, 2, 'g'); p.set(cx, 3, 'g')
    ;[1, 2, 2, 3].forEach((hw, i) => p.span(4 + i, cx, hw, (x) => (x > cx ? 'L' : 'l'))) // cap dome
    for (let y = 8; y <= 13; y++) // open pavilion
      p.span(y, cx, 3, (x) => (y >= 9 && y <= 12 && Math.abs(x - cx) <= 1 ? (y === 9 && x !== cx ? 's' : 'k') : x > cx + 1 ? 'S' : 's'))
    p.span(14, cx, 5, (x) => (x > cx + 2 ? 'S' : 'w')) // balcony
    p.span(15, cx, 4, (x) => ((x + 15) % 2 ? 't' : 's'))
    p.span(16, cx, 3, 't')
    for (let y = 17; y <= 53; y++) // shaft
      for (let x = cx - 3; x <= cx + 3; x++) {
        let k = x >= cx + 2 ? (x === cx + 3 ? 't' : 'S') : 's'
        if (y === 28 || y === 40) k = x >= cx + 2 ? 's' : 'w'
        if ([[21, 24], [33, 36], [45, 48]].some(([a, b]) => y >= a && y <= b) && x === cx) k = 'k'
        p.set(x, y, k)
      }
    p.span(54, cx, 4, 'S'); p.span(55, cx, 4, 't')
    for (let y = 56; y < H; y++) p.span(y, cx, 4, 't')
    // Lanterns hanging from both ends of the balcony
    for (const lx of [cx - 5, cx + 5]) {
      p.set(lx, 17, 'c')
      p.set(lx, 18, 'g')
      p.set(lx - 1, 19, 'g'); p.set(lx, 19, flicker ? 'A' : 'a'); p.set(lx + 1, 19, 'g')
      p.set(lx - 1, 20, 'g'); p.set(lx, 20, flicker ? 'a' : 'A'); p.set(lx + 1, 20, 'g')
      p.set(lx, 21, 'g')
    }
    return p
  }
  save('minaret-silsila', { palette, fps: 2, frames: [frame(0), frame(1), frame(0), frame(0), frame(1)] })
}

// ───────────────────────────────────────────────────────── Trees
{
  const palette = { r: '#d98a5a', G: '#4f7a57', g: '#2f5a44', d: '#1d3a30', b: '#5b3a2e' }
  const W = 7, H = 30, cx = 3
  const p = new Pix(W, H)
  for (let y = 0; y < 27; y++) {
    const t = y / 26
    const hw = t < 0.1 ? 0 : t < 0.3 ? 1 : t < 0.55 ? 2 : t > 0.93 ? 2 : 3
    for (let x = cx - hw; x <= cx + hw; x++) {
      const u = (x - cx) / (hw + 0.5)
      p.set(x, y, x === cx - hw && hw > 1 && hash(x, y) < 0.5 ? 'r' : shade(['d', 'g', 'G'], 0.55 - u * 0.5, x, y, 0.35))
    }
  }
  p.set(cx, 27, 'b'); p.set(cx, 28, 'b'); p.set(cx, 29, 'b')
  save('cypress', { palette, frames: [p] })
}
{
  const palette = { h: '#c7d0a0', G: '#9aaa7a', g: '#6f8a5c', d: '#4a6446', b: '#6b4636', B: '#4a2f26' }
  const W = 19, H = 15
  const p = new Pix(W, H)
  const blobs = [[9, 4, 8, 4], [4, 6, 4, 3], [14, 6, 4, 3], [9, 2, 5, 2.5]]
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < W; x++) {
      const inside = blobs.some(([bx, by, rx, ry]) => ((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2 <= 1)
      if (!inside || hash(x, y) < 0.08) continue
      p.set(x, y, shade(['d', 'g', 'G', 'h'], 0.75 - x / W * 0.6 - y / 12 * 0.2, x, y, 0.4))
    }
  // Gnarled trunk
  ;[[9, 9], [9, 10], [8, 10], [8, 11], [9, 11], [8, 12], [9, 12], [7, 13], [8, 13], [9, 13], [10, 13], [6, 14], [7, 14], [10, 14], [11, 14], [10, 9], [11, 8]]
    .forEach(([x, y]) => p.set(x, y, x >= 9 ? 'B' : 'b'))
  save('olive-tree', { palette, frames: [p] })
}

// ───────────────────────────────────────────────────────── People (faces left plain on purpose)
const SKIN = { F: '#d8a27a', f: '#b47f5e' }

/** Face: a plain oval — no eyes, nose or mouth. */
function face(p, cx, top) {
  p.span(top, cx, 2, 'f') // brow shadow under the head covering
  for (let y = top + 1; y <= top + 3; y++) p.span(y, cx, 2, (x) => (x === cx + 2 ? 'f' : 'F'))
  p.span(top + 4, cx, 1, (x) => (x === cx + 1 ? 'f' : 'F'))
}

// Man: black-and-white keffiyeh with agal, gold-trimmed bisht over a white thobe
{
  const W = 19, H = 40, cx = 9
  const palette = {
    ...SKIN,
    K: '#efe9dc', k: '#26222b', A: '#141117',
    T: '#f3eee4', t: '#cfc5b6',
    B: '#3a2317', b: '#5c3a26', r: '#d9824a', Y: '#e6b450', y: '#a8792e', S: '#5a3b28',
  }
  const net = (x, y) => ((x + y) % 3 === 0 || (((x - y) % 3) + 3) % 3 === 0 ? 'k' : 'K') // fishnet pattern

  const frame = (wind) => {
    const p = new Pix(W, H)
    // Bisht: A-line cloak from the shoulders down, open at the front
    for (let y = 8; y <= 36; y++) {
      const hw = y === 8 ? 5 : y < 21 ? 6 : Math.round(6 + ((y - 21) / 15) * 2)
      const open = y < 14 ? 1 : Math.round(1 + ((y - 14) / 22) * 2)
      const sway = y >= 33 ? wind : 0
      for (let x = cx - hw + sway; x <= cx + hw + (y >= 33 ? wind : 0); x++) {
        const xr = x - cx
        let k = xr < -2 ? 'b' : 'B'
        if (x === cx - hw + sway) k = 'r'
        if (Math.abs(xr) <= open) k = xr > 0 ? 't' : 'T'
        else if (Math.abs(xr) === open + 1) k = xr < 0 ? 'Y' : 'y'
        if (y === 36 && Math.abs(xr) > open + 1) k = xr < 0 ? 'y' : 'B'
        p.set(x, y, k)
      }
      if (y >= 12 && y <= 21) { p.set(cx - 5, y, 'B'); p.set(cx + 5, y, 'B') } // sleeve folds
    }
    // Thobe hem and sandals
    p.span(37, cx, 4, (x) => (x > cx ? 't' : 'T'))
    p.span(38, cx, 4, (x) => (x > cx ? 't' : 'T'))
    ;[-3, -2, -1, 1, 2, 3].forEach((dx) => p.set(cx + dx, 39, 'S'))
    // Hands, one holding prayer beads
    p.set(cx - 6, 22, 'F'); p.set(cx - 6, 23, 'F')
    p.set(cx + 6, 22, 'f'); p.set(cx + 6, 23, 'f')
    p.set(cx + 6, 24, 'Y'); p.set(cx + 6, 25, 'y'); p.set(cx + 6, 26, 'Y')

    // Keffiyeh over the head and draped over the shoulders
    const headHw = [2, 3, 4, 4, 4, 4, 4, 4, 5]
    headHw.forEach((hw, y) => p.span(y, cx, hw, (x) => net(x, y)))
    for (let y = 9; y <= 16; y++) {
      p.rect(cx - 4, y, cx - 2, y, (x) => (y === 16 ? (x % 2 ? 'K' : 'k') : net(x, y)))
      if (y <= 14) p.rect(cx + 2 + (y >= 12 ? wind : 0), y, cx + 4 + (y >= 12 ? wind : 0), y, (x) => (y === 14 ? (x % 2 ? 'K' : 'k') : net(x, y)))
    }
    // Agal: black double cord around the crown
    p.span(1, cx, 3, 'A')
    p.span(2, cx, 4, 'A')
    face(p, cx, 3)
    return p
  }
  save('keffiyeh-man', { palette, fps: 1.2, frames: [frame(0), frame(0), frame(1), frame(0)] })
}

// Woman: black thobe with red tatreez embroidery, sash and white veil
{
  const W = 19, H = 40, cx = 9
  const palette = {
    ...SKIN,
    V: '#f4efe6', v: '#d4cabb',
    D: '#211c26', d: '#3a3142', r: '#d9824a',
    R: '#d02a3e', q: '#8e1a2c', G: '#e6b450', E: '#2f7d5a',
    S: '#b3203a', s: '#7d1628',
  }
  const frame = (wind) => {
    const p = new Pix(W, H)
    // Dress silhouette
    for (let y = 9; y <= 38; y++) {
      const hw = y < 13 ? 6 : y <= 21 ? 5 : Math.round(5 + ((y - 21) / 17) * 3)
      const sway = y >= 35 ? wind : 0
      for (let x = cx - hw + sway; x <= cx + hw + sway; x++) {
        const xr = x - cx
        p.set(x, y, x === cx - hw + sway ? 'r' : xr < -2 ? 'd' : 'D')
      }
    }
    // Qabbeh: embroidered chest panel
    for (let y = 13; y <= 19; y++)
      for (let xr = -3; xr <= 3; xr++) {
        const yy = y - 13
        let k = 'D'
        if (Math.abs(xr) === 3) k = 'q'
        else if ((Math.abs(xr) + yy) % 3 === 0) k = 'R'
        if (xr === 0 && yy % 2 === 0) k = 'G'
        if (Math.abs(xr) === 1 && yy === 3) k = 'E'
        p.set(cx + xr, y, k)
      }
    // Sash
    p.span(20, cx, 5, (x) => (x === cx - 2 || x === cx + 2 ? 'G' : 'S'))
    p.span(21, cx, 5, (x) => (x > cx + 1 ? 's' : 'S'))
    // Side panels running down the skirt
    for (let y = 22; y <= 35; y++)
      for (const xr of [-4, -3, 3, 4]) {
        let k = (y + (xr < 0 ? 0 : 1)) % 2 === 0 ? 'R' : 'q'
        if (y % 4 === 0 && Math.abs(xr) === 3) k = 'E'
        p.set(cx + xr + (y >= 35 ? wind : 0), y, k)
      }
    // Embroidered hem
    for (let x = 0; x < W; x++) {
      if (p.get(x, 36) !== '.') p.set(x, 36, 'q')
      if (p.get(x, 37) !== '.') p.set(x, 37, x % 3 === 0 ? 'G' : 'R')
      if (p.get(x, 38) !== '.') p.set(x, 38, 'q')
    }
    ;[-2, -1, 1, 2].forEach((dx) => p.set(cx + dx, 39, 'D'))
    // Wide sleeves with embroidered cuffs, hands
    for (const side of [-1, 1]) {
      p.set(cx + side * 6, 22, 'R'); p.set(cx + side * 7, 22, 'q')
      p.set(cx + side * 6, 23, 'q'); p.set(cx + side * 7, 23, 'R')
      p.set(cx + side * 6, 24, side < 0 ? 'F' : 'f')
    }
    // Veil over the head and shoulders, hanging down the sides
    const headHw = [2, 3, 4, 4, 4, 4, 4, 4, 5]
    headHw.forEach((hw, y) => p.span(y, cx, hw, (x) => (x > cx + 2 ? 'v' : 'V')))
    for (let y = 9; y <= 12; y++) p.span(y, cx, 6, (x) => (Math.abs(x - cx) <= 3 && y >= 11 ? p.get(x, y) : x > cx + 2 ? 'v' : 'V'))
    for (let y = 13; y <= 19; y++) {
      const drift = y >= 16 ? wind : 0
      p.set(cx - 6, y, 'V'); p.set(cx - 5, y, 'V')
      p.set(cx + 5 + drift, y, 'v'); p.set(cx + 6 + drift, y, 'v')
    }
    face(p, cx, 3)
    return p
  }
  save('tatreez-woman', { palette, fps: 1.2, frames: [frame(0), frame(1), frame(0), frame(0)] })
}
