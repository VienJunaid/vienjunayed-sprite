#!/usr/bin/env node
// Cycles the live wallpaper to the next prayer scene, for manual preview (bound to SUPER+U). Does
// NOT touch wallpaper-swap.mjs's state file, so the next real prayer-time change still corrects it
// automatically - a preview just lasts until the next real transition.

import { execSync } from 'node:child_process'
import { connect } from 'node:net'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VIDEO_DIR = path.join(__dirname, 'wallpaper-videos')
const IPC_SOCKET = '/tmp/mpvpaper-wallpaper.sock'
const STATE_DIR = path.join(process.env.HOME, '.cache', 'rpi-dashboard')
const INDEX_FILE = path.join(STATE_DIR, 'wallpaper-preview-index')

const SCENES = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
const SCENE_LABELS = { fajr: 'Fajr · Al-Aqsa', dhuhr: 'Dhuhr · Kaaba', asr: 'Asr · Hagia Sophia', maghrib: 'Maghrib · Madinah', isha: 'Isha · Al-Farooq' }

function sendIpcCommand(command) {
  return new Promise((resolve, reject) => {
    const sock = connect(IPC_SOCKET, () => {
      sock.write(JSON.stringify({ command }) + '\n', (err) => {
        sock.end()
        err ? reject(err) : resolve()
      })
    })
    sock.on('error', reject)
  })
}

async function main() {
  await mkdir(STATE_DIR, { recursive: true })

  let index = 0
  try {
    index = (Number(await readFile(INDEX_FILE, 'utf8')) + 1) % SCENES.length
  } catch {
    index = 0
  }

  const scene = SCENES[index]
  const videoPath = path.join(VIDEO_DIR, `${scene}.mp4`)

  await sendIpcCommand(['loadfile', videoPath, 'replace'])
  await writeFile(INDEX_FILE, String(index))

  try {
    execSync(`notify-send -a "Wallpaper" "${SCENE_LABELS[scene]}" "Previewing - reverts automatically at the next real prayer time"`)
  } catch {
    // notify-send missing is non-fatal
  }
}

main().catch((err) => {
  console.error(err)
  try {
    execSync(`notify-send -a "Wallpaper" -u critical "Preview failed" "${String(err.message).replace(/"/g, "'")}"`)
  } catch {}
  process.exit(1)
})
