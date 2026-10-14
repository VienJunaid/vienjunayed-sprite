#!/usr/bin/env node
// Generates the wedding-portrait figures for the Masjid Al-Farooq page into assets/characters/.
//   node scripts/art/wedding.mjs
// Faces are left plain on purpose — no eyes, nose or mouth.
import { Pix, hash, save } from './lib.mjs'

console.log('Generating wedding portrait assets:')

const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

/** Draw a line of pixels from (x0,y0) to (x1,y1), calling fn(x, y, t). */
function line(x0, y0, x1, y1, fn) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i++) fn(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), i / n)
}

// ───────────────────────────────────────────────────────── Groom
{
  const W = 46, H = 76, cx = 26
  const palette = {
    h: '#1a1616', i: '#3a3434', // hair
    X: '#1d1b20', O: '#ece8e0', o: '#9a979c', // checkered headband
    F: '#e2b793', f: '#c8997a', // skin
    W: '#f4f2ee', w: '#d6d2cb', // white shirt
    K: '#141217', k: '#2a2730', // black bisht
    G: '#d9a441', g: '#9c6f24', H: '#f4d27a', // gold embroidery
    V: '#2b2426', v: '#4a4044', R: '#d42a2a', r: '#9e1c1c', // vase + ribbon
    Y: '#f6c945', y: '#d59a1f', U: '#ffe38a', // yellow roses
    E: '#f07a3a', e: '#c9551f', // orange roses
    b: '#f4f0ea', p: '#e6b7b0', n: '#7b8a55', // baby's breath, stems
    L: '#f5d488', l: '#e2b35a', d: '#b98a3a', // gold leaves
  }

  const frame = (sway) => {
    const p = new Pix(W, H)

    // Bisht: wide black cloak, lit on the left
    for (let y = 25; y < H; y++) {
      const hw = Math.round(y < 29 ? 10 + (y - 25) * 1.2 : 15 + (y - 29) * 0.05)
      for (let x = cx - hw; x <= cx + hw; x++) p.set(x, y, x < cx - hw + 4 ? 'k' : 'K')
    }
    // White shirt in the neck opening
    for (let y = 25; y <= 42; y++) {
      const hw = Math.max(1, Math.round(4 - (y - 25) / 5))
      for (let x = cx - hw; x <= cx + hw; x++) p.set(x, y, x > cx ? 'w' : 'W')
    }
    p.rect(cx - 5, 24, cx - 3, 26, 'W'); p.rect(cx + 3, 24, cx + 5, 26, 'w') // collar points
    // Broad gold embroidery down both sides of the opening, thin trim below
    for (let y = 25; y <= 46; y++) {
      const open = Math.max(1, Math.round(4 - (y - 25) / 5))
      for (let k = 1; k <= 3; k++) {
        const glint = (y + k + sway * 3) % 7 === 0
        p.set(cx - open - k, y, glint ? 'H' : k === 2 ? 'g' : 'G')
        p.set(cx + open + k, y, glint ? 'H' : k === 2 ? 'g' : 'G')
      }
    }
    for (let y = 47; y < H; y++) { p.set(cx - 1, y, 'g'); p.set(cx + 2, y, 'g') }
    for (let y = 58; y < H - 2; y += 2) { p.set(cx - 5, y, 'G'); p.set(cx + 7, y, 'G') } // cords
    p.set(cx - 5, H - 2, 'H'); p.set(cx + 7, H - 2, 'H')

    // Head: full, slightly messy hair, checkered headband, plain face
    for (let y = 3; y <= 16; y++)
      for (let x = cx - 9; x <= cx + 9; x++) {
        const tuft = y === 3 && hash(x, 1) < 0.4
        if (inEllipse(x, y, cx, 11, 8.4, 7.6) && !tuft) p.set(x, y, (x * 3 + y) % 7 === 0 ? 'i' : 'h')
      }
    for (let y = 12; y <= 25; y++)
      for (let x = cx - 6; x <= cx + 6; x++)
        if (inEllipse(x, y, cx, 17.8, 5.6, 7.2)) p.set(x, y, x >= cx + 3 ? 'f' : 'F')
    for (let x = cx - 8; x <= cx + 8; x++) {
      p.set(x, 9, ((x >> 1) + 9) % 2 ? 'X' : 'O')
      p.set(x, 10, ((x >> 1) + 10) % 2 ? 'X' : 'O')
      p.set(x, 11, 'o')
    }
    ;[[-5, 8], [-4, 8], [-1, 8], [2, 8], [3, 8], [-3, 12], [4, 12]].forEach(([dx, y]) => p.set(cx + dx, y, 'h')) // fringe over the band
    p.set(cx - 7, 12, 'h'); p.set(cx + 7, 12, 'h'); p.set(cx - 7, 13, 'h'); p.set(cx + 7, 13, 'h') // sides
    p.rect(cx - 1, 25, cx + 1, 25, 'f') // neck

    // Gold leaf branches spreading up and to the left from the bouquet
    const branches = [[-20, 30], [-22, 41], [-17, 53], [-12, 24], [-8, 20]]
    for (const [ex, ey] of branches) {
      line(cx - 2, 45, cx + ex + sway, ey, (x, y, t) => {
        p.set(x, y, 'd')
        if (t > 0.15 && Math.round(t * 20) % 3 === 0) {
          const side = Math.round(t * 20) % 2 ? 1 : -1
          p.set(x, y - 1 * side, 'L'); p.set(x - 1, y - 1 * side, 'l')
          p.set(x + 1, y + side, 'l'); p.set(x, y + side, hash(x, y) < 0.5 ? 'L' : 'd')
        }
      })
    }

    // Vase with a red ribbon, held in both hands
    for (let y = 46; y <= 63; y++) for (let x = cx - 2; x <= cx + 5; x++) p.set(x, y, x === cx - 2 ? 'v' : 'V')
    p.rect(cx - 2, 49, cx + 5, 50, 'R')
    p.set(cx + 6, 48, 'R'); p.set(cx + 7, 49, 'r'); p.set(cx + 6, 51, 'r'); p.set(cx + 7, 52, 'R'); p.set(cx + 6, 50, 'r')
    p.rect(cx - 4, 55, cx - 1, 57, 'F'); p.rect(cx + 4, 56, cx + 7, 58, 'f') // hands

    // Baby's breath and roses on top
    for (let y = 38; y <= 48; y++)
      for (let x = cx - 6; x <= cx + 10; x++)
        if (inEllipse(x, y, cx + 2, 43, 8.5, 5)) p.set(x, y, hash(x, y) < 0.15 ? 'n' : hash(x + 3, y) < 0.35 ? 'p' : 'b')
    const roses = [[cx - 1, 36, 'Y'], [cx + 3, 35, 'Y'], [cx + 7, 37, 'E'], [cx + 1, 39, 'Y'], [cx + 5, 40, 'Y'], [cx + 9, 41, 'E'], [cx - 3, 40, 'E']]
    for (const [rx, ry, kind] of roses)
      for (let y = ry - 2; y <= ry + 2; y++)
        for (let x = rx - 2; x <= rx + 2; x++) {
          if (!inEllipse(x, y, rx, ry, 2.4, 2.2)) continue
          const hi = x - rx + (y - ry) < -1
          const lo = x - rx + (y - ry) > 1
          p.set(x, y, kind === 'Y' ? (hi ? 'U' : lo ? 'y' : 'Y') : lo ? 'e' : 'E')
          if (x === rx && y === ry) p.set(x, y, kind === 'Y' ? 'y' : 'e')
        }
    return p
  }
  save('groom-farooq', { palette, fps: 1.5, frames: [frame(0), frame(1), frame(0), frame(0)] })
}

// ───────────────────────────────────────────────────────── Bride
{
  const W = 38, H = 72, cx = 18
  const palette = {
    F: '#ecbfa2', f: '#d4a386', // skin
    N: '#1f5a3a', n: '#2b7249', M: '#153f29', // green dupatta
    D: '#18402a', d: '#225536', // green dress
    E: '#d8c38a', e: '#b39e62', S: '#ece4cc', // gold / silver embroidery
    T: '#cfae5c', U: '#f3d98a', // maang tikka
  }
  const frame = (sway) => {
    const p = new Pix(W, H)

    // Dress: flared, dotted with silver, motifs near the hem
    for (let y = 24; y < H; y++) {
      const hw = Math.round(10 + ((y - 24) / (H - 24)) * 7)
      for (let x = cx - hw + (y > H - 6 ? sway : 0); x <= cx + hw + (y > H - 6 ? sway : 0); x++) {
        let k = x < cx - hw + 4 ? 'd' : 'D'
        if (hash(x * 3 + sway, y) < 0.025) k = 'S'
        else if (hash(x, y * 5) < 0.02) k = 'e'
        if (y >= H - 14 && y <= H - 5 && (x - cx + 30) % 6 === 0 && (y - H) % 5 === 0) k = 'E'
        if (y >= H - 14 && y <= H - 5 && (x - cx + 30) % 6 === 0 && (y - H) % 5 === 1) k = 'e'
        if (y >= H - 3) k = (x + y) % 3 === 0 ? 'e' : 'E'
        p.set(x, y, k)
      }
    }
    // Dupatta over the shoulders, hanging long down her left side with an embroidered border
    for (let y = 18; y <= 34; y++) {
      const hw = Math.round(8 + (y - 18) * 0.35)
      for (let x = cx - hw; x <= cx + hw; x++) p.set(x, y, x < cx - hw + 3 ? 'n' : hash(x, y) < 0.05 ? 'S' : 'N')
    }
    for (let y = 18; y <= 62; y++) {
      const drift = y > 54 ? sway : 0
      for (let x = cx + 8 + drift; x <= cx + 14 + drift; x++) {
        const edge = x >= cx + 13 + drift
        p.set(x, y, edge ? ((y + x) % 2 ? 'E' : 'e') : x === cx + 12 + drift ? 'S' : hash(x, y) < 0.035 ? 'S' : 'M')
      }
    }
    for (let x = cx + 8 + sway; x <= cx + 14 + sway; x++) p.set(x, 63, x % 2 ? 'E' : 'e')
    // Embroidered edge of the dupatta across her chest, where her hand holds it
    line(cx - 8, 20, cx - 3, 36, (x, y) => { p.set(x, y, 'E'); p.set(x + 1, y, 'e') })
    p.rect(cx - 5, 36, cx - 3, 38, 'F') // hand
    p.set(cx - 5, 39, 'E'); p.set(cx - 4, 39, 'E'); p.set(cx - 3, 39, 'e') // embroidered cuff

    // Head: dupatta covering the head, embroidered border framing a plain face
    for (let y = 0; y <= 22; y++)
      for (let x = cx - 9; x <= cx + 9; x++) {
        if (!inEllipse(x, y, cx, 11, 8.6, 11)) continue
        const face = inEllipse(x, y, cx, 14, 4.9, 7.2)
        const ring = inEllipse(x, y, cx, 14, 6.6, 8.8)
        if (face) p.set(x, y, x >= cx + 2 ? 'f' : 'F')
        else if (ring) p.set(x, y, (x + y + sway) % 3 === 0 ? 'S' : (x + y) % 2 ? 'E' : 'e')
        else p.set(x, y, x < cx - 5 ? 'n' : hash(x, y) < 0.06 ? 'S' : 'N')
      }
    // Maang tikka: chain from the parting, pendant on the forehead
    p.set(cx, 6, 'T'); p.set(cx, 7, 'T')
    p.set(cx - 1, 8, 'T'); p.set(cx, 8, 'U'); p.set(cx + 1, 8, 'T')
    p.set(cx, 9, 'T')
    return p
  }
  save('bride-farooq', { palette, fps: 1.5, frames: [frame(0), frame(0), frame(1), frame(0)] })
}
