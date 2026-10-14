#!/usr/bin/env node
// Restarts the live wallpaper video from the beginning every time the active Hyprland workspace
// changes, so the prayer banner's fly-in animation replays on every SUPER+1/2/3 switch (see
// docs/wallpaper-crash-log.md). Long-running - started once from autostart.conf, not a timer.

import { connect } from 'node:net'
import path from 'node:path'

const IPC_SOCKET = '/tmp/mpvpaper-wallpaper.sock'
const RECONNECT_DELAY_MS = 2000

const runtimeDir = process.env.XDG_RUNTIME_DIR
const signature = process.env.HYPRLAND_INSTANCE_SIGNATURE
if (!runtimeDir || !signature) {
  console.error('XDG_RUNTIME_DIR / HYPRLAND_INSTANCE_SIGNATURE not set - not running under Hyprland?')
  process.exit(1)
}
const hyprSocketPath = path.join(runtimeDir, 'hypr', signature, '.socket2.sock')

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

async function onWorkspaceChange() {
  try {
    await sendIpcCommand(['seek', 0, 'absolute'])
  } catch (err) {
    // mpvpaper may not be running yet (e.g. right at login) - fine, next switch will retry.
    console.error(`Restart-on-workspace-switch failed: ${err.message}`)
  }
}

function connectAndListen() {
  const sock = connect(hyprSocketPath)
  let buffer = ''

  sock.on('data', (data) => {
    buffer += data.toString()
    let newlineIndex
    while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newlineIndex)
      buffer = buffer.slice(newlineIndex + 1)
      // "workspace>>N" fires once per switch; "workspacev2>>" fires alongside it for the same
      // event - only react to one.
      if (line.startsWith('workspace>>')) {
        onWorkspaceChange()
      }
    }
  })

  sock.on('error', (err) => {
    console.error(`Hyprland event socket error: ${err.message}`)
  })

  sock.on('close', () => {
    setTimeout(connectAndListen, RECONNECT_DELAY_MS)
  })
}

connectAndListen()
console.log(`Listening for workspace changes on ${hyprSocketPath}`)
