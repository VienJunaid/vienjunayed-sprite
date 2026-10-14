# Omarchy handoff plan

Bring the RPi dashboard onto Vien's Omarchy laptop (Arch Linux + Hyprland) as native desktop
pieces: a theme, a Waybar prayer module, prayer notifications, the dashboard as an app, and the sleep
screen as the screensaver. An optional last step makes the animated scene the live wallpaper.

**Who this is for:** Claude Code running on the Omarchy machine, working through it with Vien, one
step at a time. Read `CLAUDE.md` first: it explains the project, Vien's preferences, and the traps
already hit. This plan only covers what's specific to Omarchy.

**How to use it:** Vien opens Claude Code in this repo on Omarchy and says "do step 1 of
docs/omarchy.md". Finish a step, show Vien the result, and get a yes before starting the next one.

---

## Ground rules

1. **Back up before touching anything** (step 0). A broken Hyprland config can leave Vien on an
   unusable desktop. Every change must be undoable with one `git` command.
2. **Check Omarchy's paths before editing.** Omarchy changes between releases, and the paths and
   command names below are from memory. Before each step, confirm them on the machine, for example
   `ls ~/.local/share/omarchy/bin | grep -i <topic>` and `ls ~/.config/omarchy`. If something is
   different, adapt to what's there and tell Vien.
3. **Never edit `~/.local/share/omarchy/`.** Omarchy owns it, and updates overwrite it. Put
   overrides in `~/.config/` (`hypr/`, `waybar/`, `omarchy/themes/`), which is what Omarchy expects.
4. **Keep repo changes and machine changes separate.**
   - Anything reusable (scripts, the theme folder, systemd unit templates) lives in this repo under
     `omarchy/`, so it can be reinstalled.
   - `~/.config` only gets symlinks or small include lines that point at it.
5. **Check your work.** After each step, reload the piece you changed (below), then take a
   screenshot with `grim /tmp/check.png` and look at it. Tell Vien what you saw.
6. **Follow the owner preferences in `CLAUDE.md`.** In particular:
   - No adhan audio: notifications are visual only. (The Quran player is separate: Vien starts
     it by hand. It needs `mpv`, which Omarchy ships; as a user service it already has sound.)
   - Quran text only comes from `assets/quran/quran.json`.
   - Faces stay plain.
   - Don't commit or push unless Vien asks.
7. **Secrets:** `CALENDAR_ICS` (the Google Calendar secret link) lives only in `.env`. Never print it,
   log it, or put it in a config file, a notification, or a screenshot.
8. **Battery and GPU:** this is a laptop. Anything that animates all the time (step 6) costs battery.
   Say so before doing it. The Glass blur setting is per device, so it's fine to turn on here.

**Reloading things (verify these exist first):**

| What | Command |
|---|---|
| Hyprland config | `hyprctl reload` |
| Waybar | `omarchy-restart-waybar`, or `pkill waybar && (waybar &)` |
| Theme | `omarchy-theme-set <name>` |
| Notifications (mako) | `makoctl reload` |
| A user service | `systemctl --user restart <name>` |

---

## Step 0: back up and set up the project

**Goal:** every later change can be undone, and the dashboard builds on this machine.

1. Put `~/.config` under git, if Vien doesn't already track his dotfiles some other way; ask first.
   Ignore anything with secrets or caches:
   ```bash
   cd ~/.config && git init -q 2>/dev/null; git add -A && git commit -qm "Before rpi-dashboard" || true
   ```
   Rollback for any later step: `cd ~/.config && git checkout -- . && git clean -fd <paths you added>`.
2. Node 22 or later:
   - Omarchy usually manages language versions with `mise`: `mise use -g node@22`.
   - Otherwise: `sudo pacman -S nodejs npm`.
3. Clone the repo (if it isn't already here) and install:
   ```bash
   npm install && cp .env.example .env
   ```
4. In `.env`, set:
   - `LATITUDE=33.7490` and `LONGITUDE=-84.3880` (Atlanta).
   - `CALENDAR_ICS`: Vien pastes the link himself. Don't ask for it in chat.
5. Check the timezone: `timedatectl` should say `America/New_York`.
6. Build and check it once:
   ```bash
   npm run check && npm run build && npm start
   ```
   Then open `http://127.0.0.1:8080` and confirm the home page, prayer times and Hijri date appear.

**Done when:** the dashboard runs locally, and `~/.config` has a clean commit to go back to.

---

## Step 1: the dashboard as a background service and an app

**Goal:** the server starts with the session, and the dashboard opens as its own window from the
Omarchy menu.

1. Create `omarchy/rpi-dashboard.service`, a **user** unit, not the Pi's system unit in
   `deploy/`:
   ```ini
   [Unit]
   Description=RPi dashboard (server + UI)
   After=network-online.target

   [Service]
   WorkingDirectory=%h/<path to repo>
   ExecStart=/usr/bin/env npm start
   Restart=on-failure

   [Install]
   WantedBy=default.target
   ```
   - Use the real repo path.
   - If Node comes from `mise`, `npm` may not be on the service's `PATH`. Point `ExecStart` at the
     absolute path from `mise which npm`.
2. Install it:
   ```bash
   ln -sf "$PWD/omarchy/rpi-dashboard.service" ~/.config/systemd/user/
   systemctl --user daemon-reload && systemctl --user enable --now rpi-dashboard
   ```
3. Add an app launcher:
   - Omarchy has a web-app installer. Look for `omarchy-webapp-install` or a "Web App" entry in the
     Omarchy menu.
   - Name it "Dashboard", pointed at `http://127.0.0.1:8080`.
   - If there's no installer, write `~/.local/share/applications/rpi-dashboard.desktop` that runs
     `chromium --app=http://127.0.0.1:8080 --class=rpi-dashboard`.
4. Optional: a Hyprland keybinding (for example `SUPER + D`, if it's free) in
   `~/.config/hypr/bindings.conf` that launches the same command.

**Test:**
- `systemctl --user status rpi-dashboard` shows it's active.
- The launcher opens a window with no browser bar, and tapping the clock opens Settings.

**Done when:** the dashboard is still running after a reboot, and it opens from the menu.

---

## Step 2: the "Al-Farooq Night" Omarchy theme

**Goal:** a proper Omarchy theme made from the dashboard's colours, with pixel-art wallpapers from
the scenes.

1. Look at an existing theme to copy its structure. Don't guess the file list:
   ```bash
   ls ~/.local/share/omarchy/themes/*/
   ```
   Themes usually include colours for the terminal, Waybar, Hyprland borders, the lock screen,
   notifications, the menu and btop, plus a `backgrounds/` folder.
2. Create `omarchy/themes/al-farooq-night/` in the repo, with the same files.
   - Take colours from `config/themes/farooq-night.json` and `haram-night.json`: background
     `#161522`-ish, gold accent `#f2cf72`, muted `#8a86a0`, text `#eeece6`.
   - Keep contrast readable in the terminal.
3. **Wallpapers:** export one PNG per prayer scene at the laptop's native resolution (check with
   `hyprctl monitors`), into `backgrounds/`:
   - Scenes: `aqsa-fajr`, `kaaba-dhuhr`, `sophia-asr`, `madinah-maghrib`, `farooq-isha`, plus
     `haram-aerial` and `kazakh-meadow`.
   - Use the screenshot method in `CLAUDE.md → Gotchas → Screenshot testing` (puppeteer-core) on
     `http://127.0.0.1:8080/?scene=<name>`. Before capturing, hide the scenery ✕ button with CSS:
     `.exit-scenery { display: none }`.
   - **Don't** export `farooq-wedding` into anything that might be shared; it's personal (CLAUDE.md).
4. Install it by symlinking it where Omarchy looks for user themes (check which folder; usually
   `~/.config/omarchy/themes/`), then run `omarchy-theme-set al-farooq-night`.
5. Optional, needs Vien's go-ahead: switch the wallpaper with the prayer times. A small script plus a
   systemd user timer (every 5 minutes) finds the current period from the local API and sets the
   matching background. It uses whatever wallpaper command Omarchy uses; look for `swaybg` in its
   scripts.

**Test:** screenshot the desktop and check that the terminal, Waybar and menu colours all match.

**Done when:** the theme appears in Omarchy's theme picker and can be switched back and forth.

---

## Step 3: Waybar prayer module

**Goal:** Waybar shows `☾ Asr · 23m`. The tooltip lists all five times and the Hijri date, and
clicking opens the dashboard.

1. Create `omarchy/waybar-prayer.mjs`, a Node script that prints Waybar's custom-module JSON:
   `{"text": "...", "tooltip": "...", "class": "..."}`.
   - Read `GET http://127.0.0.1:8080/api/prayer/today` for the times.
   - Use `formatTime` rules: 12- or 24-hour from the clock widget's `hour12` in
     `GET /api/config`.
   - Work out the Hijri date the same way as `apps/web/src/lib/hijri.ts`: Intl
     `islamic-umalqura`, shifted by `hijri.offset` from the config. Reuse the logic, don't invent a
     new calendar.
   - `class`: `soon` in the 15 minutes before a prayer, and `now` in the first 12 minutes of one
     (the same window as the banner), so CSS can colour it.
   - If the server is down, print `{"text": "☾"}`. Never crash Waybar.
2. Add the module to `~/.config/waybar/config.jsonc` (keep Vien's existing modules):
   ```jsonc
   "custom/prayer": {
     "exec": "node <repo>/omarchy/waybar-prayer.mjs",
     "return-type": "json",
     "interval": 30,
     "on-click": "<the step 1 launcher command>"
   }
   ```
   Put it next to the clock, then add styles for `#custom-prayer`, `.soon` and `.now` in the Waybar
   stylesheet (gold for `.now`).

**Test:** restart Waybar and take a screenshot. For a quick check, run the script directly and paste
its output.

**Done when:** the module shows the right next prayer, its countdown goes down, and clicking it opens
the dashboard.

---

## Step 4: prayer notifications (visual only)

**Goal:** a quiet desktop notification at each prayer time: "Asr · 4:50 PM". **No sound. Vien
declined adhan audio.**

1. Create `omarchy/prayer-notify.mjs`.
   - It runs every minute. If a prayer started within the last minute, it sends
     `notify-send -a "Salah" "Asr" "4:50 PM"`, without an urgency level that plays a sound.
   - Keep a small state file in `~/.cache/rpi-dashboard/` so no prayer is announced twice.
2. Set up a systemd user timer that runs it every minute (`OnCalendar=*:*:00`), as a unit pair under
   `omarchy/`, symlinked into `~/.config/systemd/user/`.
3. Check Omarchy's notification daemon (usually mako) doesn't have a sound rule for this app.

**Test:**
- Temporarily run the script with a fake "now" (add a `--at HH:MM` flag for testing).
- Check `makoctl history`.

**Done when:** exactly one silent notification appears at each prayer.

---

## Step 5: the sleep screen as Omarchy's screensaver

**Goal:** when the laptop is idle, instead of Omarchy's text screensaver, show the dashboard's
**sleep screen**: pitch black, the time as a shining pixel title, and the next prayer under it. Any
input closes it.

1. **Repo change:** support `?sleep` in the URL, so the page starts in sleep mode.
   - Today sleep mode only comes from Settings or `sessionStorage` (`view.sleeping` in
     `lib/viewState.svelte.ts`).
   - Add a URL check next to the `sessionStorage` read.
   - Keep it small, and run `npm run check`.
2. Find how Omarchy launches its screensaver. It's usually a hypridle listener in
   `~/.config/hypr/hypridle.conf` that calls an `omarchy-launch-screensaver`-style script. Read it
   before changing anything.
3. Add `omarchy/screensaver.sh`. It opens the sleep screen full-screen:
   ```bash
   chromium --app="http://127.0.0.1:8080/?sleep" --class=rpi-screensaver --kiosk
   ```
   Then use a Hyprland window rule (in `~/.config/hypr/`) to make that class full-screen on the
   focused monitor with no animation.
4. **Closing it:**
   - A web page can't close its own window. Make the hypridle listener's `on-resume` run
     `pkill -f -- '--class=rpi-screensaver'`.
   - Omarchy's own screensaver probably exits on input in a similar way. Copy its approach if it has
     a better one.
5. Point Omarchy's screensaver timeout listener at the new script. Leave the **lock-screen** and
   **suspend** listeners exactly as they are.
6. The Glass blur setting doesn't matter here: the sleep screen doesn't blur.

**Test:**
- Run the script by hand and check it shows full-screen.
- Move the mouse and check it closes.
- Then lower the idle timeout to about 30 s, wait, and check again. Put the timeout back afterwards.

**Done when:** it starts after the usual idle time, closes on any input, and locking and suspending
still work.

---

## Step 6 (optional): live animated wallpaper

**Only with Vien's clear go-ahead.** It uses GPU and battery the whole time the desktop is visible.

**`hyprwinwrap` does not work on this machine and never will.** This laptop is aarch64 (Asahi
Linux / Apple Silicon), and Hyprland's plugin function-hooking API — which any version of
hyprwinwrap needs to pin a live window behind everything else — only works on x86_64. This isn't a
version/build problem; it's an architectural limitation of Hyprland itself. Don't retry
hyprwinwrap here. Full investigation and crash history: `docs/wallpaper-crash-log.md`.

**What's built instead: `mpvpaper`** (a Wayland layer-shell video-background daemon, no window
hooking needed, so it works on any architecture). Trade-off: instead of the live Chrome canvas,
each prayer scene is pre-rendered to a looping 1080p video once, and swapped as the period changes.

1. `mpvpaper` is already installed on this machine. If setting this up fresh elsewhere:
   `sudo pacman -S mpvpaper` (it's in the official `extra` repo, no AUR/hyprpm involved).
2. Render the videos (needs `npm start` already running):
   ```bash
   npm run render-wallpaper-videos
   ```
   This is `omarchy/render-wallpaper-videos.mjs` — it drives headless Chrome (puppeteer-core) over
   each prayer's `?scene=<name>` (scenery mode: art only, no clock/Salah/verse widgets — the live
   dashboard window already provides those), screenshots at the app's own 20fps, and pipes frames
   into `ffmpeg` as h264 MP4s under `omarchy/wallpaper-videos/` (gitignored — regenerate, don't
   commit).

   The six non-prayer scenery scenes (`aqsa-sunset`, `farooq-wedding`, `haram-aerial`,
   `kazakh-meadow`, `madinah`, `night-mosque` — see CLAUDE.md's scene table) get the same
   treatment via a sibling script:
   ```bash
   node omarchy/render-scenery-videos.mjs
   ```
   Same pipeline (headless Chrome → `?scene=<name>` → ffmpeg), but writes straight into
   `omarchy/wallpaper-videos-clean/` (no bannered variant — these scenes have no "prayer just
   started" concept) named by scene, e.g. `haram-aerial.mp4`. Pass scene names as args to render
   a subset; with no args it renders all six.
3. `omarchy/wallpaper-swap.mjs` is the runtime piece: idempotent, reads `/api/prayer/today`, works
   out the current period, and either launches `mpvpaper` or hot-swaps its file over mpv's IPC
   socket (no flash on prayer-time transitions). It also kills Omarchy's default `swaybg`, which
   claims the same background layer and would otherwise cover the video.

   `--pin <name>` accepts either a prayer (`fajr`/`dhuhr`/`asr`/`maghrib`/`isha`) or one of the
   six scenery scenes above (the full `PINNABLE` list in the script); `--auto` releases any pin
   back to following real prayer times. Scenery pins skip the window-glow recolor (`GLOW_COLORS`
   only covers the five prayers — there's no "time of day" for e.g. a Kaaba aerial shot).
4. Wired up two ways: `~/.config/hypr/autostart.conf` runs it once at login, and
   `omarchy/wallpaper-swap.timer` (`OnCalendar=*:*:00`, symlinked into
   `~/.config/systemd/user/` like `rpi-dashboard.service`) re-checks every minute.
5. Leave Glass blur off here. Nothing is drawn on top anyway.
6. `~/.config/omarchy/extensions/menu.sh`'s `show_background_menu()` lists all eleven scenes
   (prayers + scenery) above Omarchy's normal "Choose image…" picker (`SUPER ALT SPACE` → Style →
   Background). Each entry just runs `wallpaper-swap.mjs --pin <name>`.

**Test:** check CPU and GPU in `btop` for a few minutes, and tell Vien the numbers — this matters
more than usual here since Asahi's GPU video-decode support is immature and mpv may be
software-decoding.

**Done when:** the correct prayer scene plays as the desktop background, swaps cleanly as prayer
times change, and turning it off (`systemctl --user disable --now wallpaper-swap.timer`, remove
the autostart line, `pkill mpvpaper`) returns the normal Omarchy wallpaper.

---

## Rollback

| Step | Undo |
|---|---|
| Any `~/.config` change | `cd ~/.config && git checkout -- <file>` (or `git stash`) |
| 1 Service | `systemctl --user disable --now rpi-dashboard` and remove the symlink |
| 2 Theme | `omarchy-theme-set <previous theme>` |
| 3 Waybar | Remove `custom/prayer` from the Waybar config and restart Waybar |
| 4 Notifications | `systemctl --user disable --now prayer-notify.timer` |
| 5 Screensaver | Restore `hypridle.conf` from git, then `pkill hypridle && (hypridle &)` |
| 6 Wallpaper | `systemctl --user disable --now wallpaper-swap.timer`, remove the autostart line, `pkill mpvpaper` |

## Decisions to ask Vien about

- **Theme:** should the wallpaper change with the prayer times (step 2.5), or stay on one scene?
- **Waybar:** where should the module go (next to the clock?), and should it show the countdown
  always, or only in the hour before a prayer?
- **Screensaver:** after how many minutes idle? Keep Omarchy's current timing unless he says
  otherwise.
- **Step 6:** does he want the live wallpaper at all, given the battery cost?
- **Commits:** should the new `omarchy/` folder be committed, and when? He decides; don't commit
  without asking.
