# CLAUDE.md — RPi Dashboard

Read this first when you start a session. It records the project, the owner's preferences, how the
code fits together, and the traps already hit. Keep it current when behavior or conventions change.

## What this is

A full-screen **Islamic pixel-art / ASCII home screen** for a Raspberry Pi, inspired by the terminal
look of Omarchy. It is built for **Vien** and his wife, in Atlanta. Their masjid is **Masjid Al-Farooq**,
where they married.

- **Home page (page 1):** the scene **changes with the prayer times**. Each prayer has its own place,
  its own light, and the couple in local dress. On top sit the clock (with the Hijri date), the Salah
  times, a rotating Quran verse, and a "prayer just started" pixel animation.
  - **Tap the right or left half** of the screen to change pages. There is no next button any more.
  - **Tap the verse box** to open the **Quran player**: all 114 surahs recited by Shaykh Bandar
    Baleela. Tap a surah to play it, then loop it or continue to the next. While it plays, the verse
    box shows the exact ayah being recited. It pauses for the first 20 minutes of each prayer.
  - **Tap the clock** to open Settings: **sleep mode**, scenery mode, the Quran player, 24-hour time (everywhere), the verse on/off, the current
    prayer on/off (`prayer.showCurrent`), the Hijri date adjustment (−1/0/+1, `hijri.offset`), and
    **Home background** (any scene, or follow the prayer times). With the current prayer on, the banner stays up all period
    with "ASR · 4:52 PM". It sits under the verse, or is boxed in the verse's place when the verse is
    off.
  - **Scenery mode** shows only the art. Tapping left or right browses every scene in
    `config/scenes/`, and a faint ✕ at the bottom middle returns home.
- **Pages 2–5:** extra pages you reach by swiping. Pages 3 and 4 have no text. Pages 2–4 have one
  small see-through **▣ Background** box at the bottom middle (styled like the clock box). It opens
  the same background picker as Settings. The System page has no box, because it is plain.
  - Masjid al-Haram from the air at night. It is the one exception: two cards sit on the rooftops, and
    **the middle stays clear** so the Kaaba and the tawaf stay the focus.
    - **Left, Hijri:** today's Hijri date and the next important days. Tap it to open the whole
      Islamic year. The date assembles itself in pixels at the top (`PixelTitle`), with 12 month tiles
      below.
    - **Right, Calendar:** Vien's Google Calendar, read from its secret iCal link (`CALENDAR_ICS` in
      `.env`). Tap it to open a month grid that also shows each day's Hijri date. The month name
      assembles itself in pixels too.
    - Both cards use `widgets/SideCard.svelte`, so they match: the same box, a big line, a small
      line, four two-line items, and "▸". Each is centered on its rooftop band.
    - Both open views are 33vw wide and stop before the mataf. Tapping outside one closes it without
      changing the page.
  - Madinah by day
  - the couple's wedding portrait at the Al-Farooq arch
  - **System**: Raspberry Pi health, btop-style (`system-health` widget in the `full` area).
    - **Deliberately plain:** the page sets `plain: true`, so there's no scene and the render loop is
      paused (`AsciiScene` `paused`). The panels are solid with no backdrop blur, and the title is
      plain text. An animated scene behind six blurred panels, plus a `PixelTitle`, made the Pi lag
      here, so keep this page cheap.

    It has six panels:
    - CPU, with per-core bars and load.
    - Temperature, with fan speed and throttling flags from `vcgencmd`.
    - Memory and storage.
    - Network, with IPs, Wi-Fi signal and traffic.
    - System, with the top processes.
    - Dashboard: git version, service uptime, renderer FPS and ms/frame, and calendar sync.

    It also shows 30 minutes of history charts and one overall status word.

| Prayer | Scene file | Place and light | Couple's outfits |
|---|---|---|---|
| Fajr (until Dhuhr) | `aqsa-fajr` | Al-Aqsa. The sky follows the real clock from pre-dawn to sunrise (`dawn: true`). | Palestine: thobe with a keffiyeh scarf; black tatreez dress with a white veil |
| Dhuhr | `kaaba-dhuhr` | The Kaaba from the mataf at midday, with rows of pilgrims | Hajj: ihram; black abaya with a **full black niqab (no eyes)** |
| Asr | `sophia-asr` | Hagia Sophia through a dark gateway, warm afternoon | Turkey: navy Ottoman-style kaftan with a red sash; camel coat with a turquoise scarf |
| Maghrib | `madinah-maghrib` | Madinah at sunset with the giant umbrellas open and the lamps lit | Saudi: thobe, shemagh and agal; black abaya with a shayla |
| Isha (until Fajr) | `farooq-isha` | The Al-Farooq courtyard at night with a night market (tents, queues, string lights, fountain) | Atlanta: kurta, waistcoat and his checkered headband; dusty-rose hijab and cardigan with a cup of chai |

**Scenery-only scenes** (reached in scenery mode):

- `kazakh-meadow`: the couple on horseback in a Tian Shan meadow (snowy peaks, spruce slopes, a path,
  dandelions). He rides the dappled grey in a dark velvet jacket with gold and silver ornament and a
  brown head wrap. She rides the white horse in a red embroidered vest and white frilled dress, with a
  white hijab under a red takiya and a feather plume. Effect: `meadow.ts`. Riders: `scripts/art/horses.mjs`,
  with a walk cycle and a pixel outline around the horses.
- `aqsa-sunset`: the same Al-Aqsa scene as Fajr, but at sunset light instead of dawn, with the
  couple in their Palestine outfits (keffiyeh/tatreez) rather than the Fajr scene's alternate set.
- `farooq-wedding`: the Al-Farooq archway, daytime, bride and groom in wedding dress at the arch
  (`farooq-arch` background, `effect: farooq`).
- `haram-aerial`: an aerial view of the Masjid al-Haram mataf — pilgrims circling the Kaaba, pigeons
  overhead (`effect: haram`). No couple; it's a wide establishing shot, not a street-level scene.
- `madinah`: Masjid an-Nabawi by day, no couple (`plain`-style, art only).
- `night-mosque`: a generic mosque silhouette at night — crescent moon, two lanterns, water
  reflection (`effect: water`, theme `tokyo-night`).

All eleven scenes (five prayer + six scenery-only) are also pinnable as the live desktop
wallpaper outside the app — see `docs/omarchy.md` Step 6 and `docs/wallpaper-crash-log.md`.

## Owner preferences (follow these)

- **Claude writes the code for this project.** The user asked for this explicitly. This overrides the
  global "hints only" memory, which applies to the user's coursework.
- **Faces are always plain:** no eyes, nose or mouth on any character. The niqab is solid black with no
  eye slit.
- **Outfits follow the culture of the place** in each scene. Hajj scenes use Hajj clothing. His wife
  always wears hijab, even when the reference photo doesn't. For example, in the Kazakh scene she wears
  a hijab under the traditional takiya.
- **Reference photos are for composition only.** Draw original pixel art; never trace or embed the photo
  (some are watermarked stock images).
- **Quran verses must be uplifting.** Use the curated `verse.featured` list in `config/dashboard.json`.
  Every verse there was checked to fit on screen (Arabic ≤ ~110 characters, translation ≤ ~140).
  Never type Quran text by hand. All Arabic comes from `assets/quran/quran.json` (Tanzil, unmodified).
- **No adhan audio.** The user declined it. A visual animation plays at prayer start instead.
  - The **Quran player** is different: it is audio the user asked for and starts by hand. Don't mix
    the two up, and never make anything play sound on its own.
  - The recitation **pauses for the first 20 minutes of each prayer** (`recitation.prayerPauseMinutes`).
- **The verse box** sits top-center, level with the tops of the clock and Salah boxes, and must never
  overlap them.
- **Don't commit or push without being asked.** The user does that. Remote:
  `github.com/VienJunaid/rpi-dashboard`.
- **Personal images** (the wedding photo, the couple's art) stay out of `docs/` screenshots.

## Run and deploy

```bash
npm install && cp .env.example .env
npm run dev                  # Mac: server :8080 + Vite :5173
npm run build && npm start   # production server on :8080 (also serves the UI)
npm run check                # svelte-check + tsc (keep at 0 errors, 0 warnings)
npm run art                  # regenerate the pixel-art figures in scripts/art/*.mjs
npm run fetch-recitation -- 217 "Shaykh Bandar Baleela"   # re-download the ayah timings
```

The Quran player needs **`mpv`** on the machine that runs the server (`brew install mpv`,
`sudo apt install mpv`; `setup-pi.sh` installs it). Without it the player says so and nothing else
breaks.

On the Pi, the first time: `./scripts/setup-pi.sh`, then `sudo reboot`. After that: `npm run update`
(git pull, rebuild, restart). Re-run `setup-pi.sh` when `deploy/rpi-dashboard.service` changes (it
is safe to re-run). The Pi runs a systemd service (`rpi-dashboard`) and Chromium in kiosk mode
from labwc autostart. `.env` needs `LATITUDE`/`LONGITUDE`, and the Pi's timezone must match.

**On Vien's Omarchy laptop** (Arch + Hyprland), follow [docs/omarchy.md](docs/omarchy.md). It's a
step-by-step plan: back up, run it as a user service, theme, Waybar prayer module, silent
notifications, sleep screen as the screensaver, and an optional live wallpaper. Do one step at a
time, with Vien's OK between steps.

**Preview URL parameters:**

| Parameter | Effect |
|---|---|
| `?prayer=fajr\|dhuhr\|asr\|maghrib\|isha` | Force a prayer period |
| `&dawn=0..1` | Fajr sunrise progress |
| `&banner` | Show the prayer-start animation |
| `&debug` | Renderer, grid size, FPS and ms per frame |
| `&renderer=canvas2d` | Use the fallback renderer |
| `?scene=<name>` | Open scenery mode on any scene, e.g. `kazakh-meadow` |

## Architecture (short version; see ARCHITECTURE.md)

```
apps/server (Fastify, TS)   /api/config (+/scenes, /themes)  /api/assets  /api/events (SSE live reload)
                            /api/prayer/today (adhan)  /api/quran/random  /api/spotify/*  /api/calendar/events
                            /api/system (Pi health)  /api/recitation/* (Quran player, plays through mpv)
apps/web (Svelte 5 + Vite)  App.svelte → AsciiScene.svelte (WebGL2/Canvas2D) + widgets + Verse + PixelTitle
config/                     dashboard.json (pages, widgets, verse, prayer), scenes/*.json, themes/*.json
assets/                     characters/*.json (ASCII or pixel art), backgrounds/*.json, fonts, quran.json,
                            quran/recitation.json (ayah timings)
data/                       runtime, gitignored: saved surah audio, the player's place, Spotify tokens
scripts/art/                code-generated pixel art: aqsa.mjs, wedding.mjs, couple.mjs (+ lib.mjs)
```

**Rendering:**
- Every cell has a glyph (8-bit), a foreground and a background color. Colors are **12-bit ids, up to
  4,096**, in one palette shared by all pages.
- Pixel art uses **half blocks**: `▀` with fg = the top pixel and bg = the bottom pixel. The grid is
  **60 rows** on every screen, so 1080p is 192×60 cells, or 192×120 pixels.
- A scene draws: background (ASCII into the grid, or pixels into `PixelLayer`) → pixel sprites →
  `resolve()` → ASCII sprites → `overlay()`.
- The WebGL cell texture is RGBA8: r = glyph, g/b = the low bytes of fg/bg, a = the high nibbles. The
  palette is a 64×64 texture.

**Pages and prayers:**
- `dashboard.json → pages[]` entries have either `scene` or `sceneByPrayer`.
- `App.svelte` loads every scene up front, into one flat list.
- `lib/prayerClock.ts` works out the current period (Fajr lasts until Dhuhr, Isha until the next Fajr)
  and the dawn progress.
- `App` checks every 20 s. When the period changes, `active` changes and `AsciiScene` plays the pixel
  wipe.
- The banner shows for the first 12 minutes of a period (the real one only).
- **Tap to preview:** tapping a prayer row in the Salah widget sets `view.selected` in
  `lib/viewState.svelte.ts`, and the home scene switches to that prayer's scene.
  - Yellow `#ffd166` ◀ marks the live prayer; light blue `#7fe3ff` ◆ marks the picked one.
  - Tapping the picked row or the live row clears the selection.
  - A real period change clears it too (in `App.svelte`'s 20 s tick).
- **Settings and scenery mode:** `view.settingsOpen` and `view.scenery` live in `viewState.svelte.ts`.
  - Tapping the clock opens `components/Settings.svelte`.
  - Settings toggles write `dashboard.json` through `PUT /api/config`, and the file watcher reloads the
    page.
  - In scenery mode, `App` loads every scene from `GET /api/config/scenes`, builds a gallery order
    (prayer scenes, then pages, then the rest), and left or right taps step through it.
  - Tap zones ignore taps on `button`, `.panel`, `figure` (the verse) and the banner.
  - The verse box is covered by one invisible `button` that opens the Quran player.

**Sleep mode and 12/24-hour time:**
- **Sleep mode** (`view.sleeping`, `components/SleepScreen.svelte`) is started from Settings
  (`goToSleep`).
  - The screen goes pitch black. `AsciiScene` is paused and every widget is unmounted, so their timers
    and polling stop.
  - Only the time shows, as a shining `PixelTitle` (scale 2), with a smaller one under it:
    "FAJR 6:22 AM · IN 3H 32M". It reads "TIME FOR ASR" in the first 12 minutes of a prayer.
  - It ticks on the minute, and each minute the title re-assembles at a new spot (±15% of the width,
    ±20% of the height) to prevent burn-in.
  - Tap anywhere, or press Esc, to wake. It's kept in `sessionStorage` (`dashboard:sleep`), so a live
    reload overnight doesn't light the screen up.
  - The server still runs, including the System page sampler, which is cheap.
- **12/24-hour time:** one setting, stored as the clock widget's `hour12` option.
  - `App` calls `setHour12()` at load, and everything formats with `lib/timeFormat.ts` `formatTime()`:
    the clock, Salah times, prayer banner, calendar events, the Quran player and the sleep screen.
  - 24-hour uses `hourCycle: 'h23'`, because `hour12: false` shows "24:05" in some browsers.
  - Don't create time formatters at module load: they would run before the setting is applied.

**Quran player:**
- **The server plays the audio**, not the browser (`services/recitation.ts`, through `mpv` and its
  JSON IPC socket). A settings change reloads the page, and that must not cut the recitation off.
  The screen is only a remote.
  - `RECITATION_MPV_ARGS` in `.env` adds mpv options, e.g. `--audio-device=…` to pick the speaker,
    or `--ao=null` to test without sound.
  - mpv is started on the first play and killed on stop, and when the server exits.
- **Audio:** one MP3 per surah from mp3quran.net (read 217, Hafs 'an 'Asim, 26.3 hours, about 3 GB
  in all). The first play streams it and saves it to `data/quran-audio/217/NNN.mp3`; after that it
  plays from disk, offline. In continue mode the next surah is saved ahead of time.
- **Follow-along:** `assets/quran/recitation.json` (from `scripts/fetch-recitation.mjs`) holds each
  ayah's start time for all 114 surahs. The script refuses to write unless every surah's ayah count
  matches `quran.json`.
  - The server checks mpv's position four times a second and works out the ayah. The text shown is
    always from `quran.json`.
  - **Ayah 0 is the opening** before ayah 1: the Bismillah (split from the data, as `getVerse`
    does), or the surah's name for At-Tawbah, which has none. Al-Fatiha and Ghafir have no separate
    opening in the timings, so they start at ayah 1.
- **State goes to the screen by push:** every change is sent as a `recitation` event on the
  `/api/events` stream (the same one as live reload; `lib/api.ts` `serverEvents()`), and kept in
  `lib/recitation.svelte.ts`. Nothing polls.
  - Status: `idle` (stopped; the place is remembered), `loading`, `playing`, `paused`, `prayer`.
  - `Verse.svelte` shows `recitation.now.verse` whenever the status isn't `idle`, and shrinks long
    ayat to fit (`--fit`); the daily verses come back on Stop. The box also shows while reciting
    with the verse setting off.
  - `components/QuranPlayer.svelte` (`view.quran`) is the panel: the surah list, play/pause/stop,
    Continue or Loop surah, volume, and the surah's name as a `PixelTitle`.
  - The sleep screen adds one line, "QURAN · AL-MULK", while it plays.
- **Prayer pause:** at a prayer's start it fades out and waits `recitation.prayerPauseMinutes`
  (20), then resumes at the **start of the ayah** it stopped on, with no fade-in (a fade swallowed
  the first words). "Play now" in the panel overrides that one pause. A surah picked during the
  pause waits too.
- **The place is remembered** in `data/recitation.json` (surah, ayah, mode, volume). After a
  server restart it comes back stopped, never playing.
- **On the Pi** the service sets `XDG_RUNTIME_DIR=/run/user/<uid>`, so mpv can reach the desktop
  session's sound server (PipeWire). Without it, a system service has no speaker.

**Backgrounds:**
- `pages[].sceneOverride` (a `config/scenes` name) wins over the page's `scene` or `sceneByPrayer`.
  With no override, the page shows its own scene; the home page follows the prayer times.
  - On the home page, tapping a prayer in the Salah box still previews that prayer's scene.
- `components/BackgroundPicker.svelte` lists every scene in gallery order.
  - `view.picking` is the page being changed, and `view.preview` is the scene shown live behind the
    picker.
  - Save writes `dashboard.json`, and the file watcher reloads the page. Cancel, a tap outside the
    picker, or Esc puts the old scene back.
- `App` keeps the page number in `sessionStorage` (`dashboard:page`), so a reload stays on the same
  page. It reads the number before the effect that records page 0 on startup can overwrite it.
- The Haram page's calendar cards stay if you change its background, but they're positioned for the
  Haram rooftops.

**System page:**
- `services/system.ts` starts with the server. It samples every 3 s and keeps 600 samples (30 min)
  of CPU, RAM, temperature and network history, so the charts are full as soon as the page opens.
  - On the Pi it reads `/proc`, `/sys` (temperature, CPU clock, Pi 5 fan) and `vcgencmd
    get_throttled` (every 15 s), plus `ps` for the top processes (every 9 s).
  - On the Mac those readings are null, and the page says "only on the Pi".
  - RAM used is MemTotal − MemAvailable, not MemFree: Linux uses free RAM as cache.
- `lib/renderStats.ts`: AsciiScene publishes renderer, grid size, FPS and ms/frame every 30
  frames. It's a plain object that the page polls, so the render loop never triggers Svelte updates.
- `widgets/system-health/Chart.svelte`: a pixel bar chart made of CSS grid columns, stepped heights,
  newest on the right.
- **Status colours:** green, yellow, orange and red. Temperature turns yellow at 60, orange at 70 and
  red at 80 °C; usage at 70, 85 and 95 %.

**Calendars (Haram page):**
- `dashboard.json → pages[].widgets` can be `true` (the shared `widgets` list) or the page's own list.
  The Haram page lists `islamic-calendar` (`rooftop-left`) and `calendar` (`rooftop-right`).
- The `rooftop-*` areas in `App.svelte` sit at 50vw ± 57.5vh: the middle of the rooftop band in
  `haram.ts`, which runs from portico rx 46 to outer rx 92 of 120 pixel rows. The areas set the cards'
  size (31vh × 36vh). **Don't put a `transform` on them:** it would trap the cards' full-screen views
  (`position: fixed`).
- `lib/hijri.ts` does the Hijri work offline with Intl's Umm al-Qura calendar: `toHijri`, `hijriYear`
  (scans for the Gregorian start of each month) and `islamicEvents`. The clock uses it too.
  - Only widely agreed days are listed (no Mawlid, 15 Sha'ban or 27 Rajab); add them in `EVENTS`.
  - `hijri.offset` shifts every Hijri date, to match Al-Farooq's moonsighting.
- `view.expanded` (`'hijri' | 'calendar' | null`) opens the big views. While a view is open, page
  navigation is blocked.
- The server (`services/calendar.ts`, `ical.js`) reads every link in `CALENDAR_ICS` (comma-separated;
  each calendar gets a color) and expands repeating events from about 40 days back to 100 ahead. It
  caches for 10 minutes and serves the last good copy when offline.
  - **The iCal link is a password:** it stays in `.env`, and it is never logged or sent to the browser.
  - The public `…/public/basic.ics` link returns 404 unless the calendar is public. Don't make it
    public; use the secret address.
- `components/PixelTitle.svelte` (formerly PrayerBanner) turns a title plus a subtitle into the
  fly-in pixel title.
  - `text` can be Arabic (Amiri, flies in right to left) or Latin (JetBrains Mono, upper-cased, left
    to right).
  - `maxWidth` shrinks the pixels to fit.

**Scenes** (procedural backgrounds in `apps/web/src/scene/backgrounds/`):
- `sunset.ts` has the `dawn` option.
- `madinah.ts` has `time: 'sunset'` and `openUmbrellas`.
- The others are `kaaba.ts`, `sophia.ts`, `farooqNight.ts`, `haram.ts` (aerial), `farooq.ts` (the
  wedding arch) and `water.ts` (ASCII night).
- Each builds a static base once per screen size, then animates a few things per frame. Register new
  effects in `backgrounds/index.ts`.

## Conventions

- **Adding a scene:**
  1. Write an effect in `scene/backgrounds/`.
  2. Register it in `index.ts`.
  3. Add `assets/backgrounds/<name>.json` (`effect` and `params`).
  4. Add `config/scenes/<name>.json` (theme, background, characters).
  5. Add `config/themes/<name>.json`.
  6. Reference the scene in `dashboard.json`.
- **Pixel-art sprites:** JSON with a `palette` (key → hex) and `frames` (rows of keys, where `.` is
  transparent). Generate them from code in `scripts/art/`. The couple are 26×54 (him) and 26×51 (her).
  Place them at x ≈ 0.462 and 0.542, y 0.985, anchor `bottom-center`.
- **Light comes from the left:** lit on the left, shaded on the right. Add dithering at shading seams
  (`bayer`).
- **Performance budget:** under 1 ms of scene CPU per frame on a laptop, since the Pi is about 10×
  slower. Precompute static layers.

## Gotchas already hit

- **Tiny shapes read as crosses.** A 5-px pixel diamond looks like `+`, and a minaret with a balcony
  crossbar looks like `†`. Use ≥ 9-px diamonds, round glows (2×2 core plus a dithered halo), and
  domes or cones instead of crossbars.
- **The 256-color palette overflowed** once there were several pages, and everything turned the first
  sunset color. It's 12-bit now, and a warning is logged if 4,096 is ever reached.
- **Detecting the Bismillah:** the diacritic order differs between encodings, so compare the letters
  with the marks stripped (`services/quran.ts`). The displayed Bismillah comes from the data, not a
  typed string.
- **Screenshot testing:** use `puppeteer-core` with the system Chrome
  (`--use-angle=swiftshader --enable-unsafe-swiftshader`). Plain `chrome --headless --screenshot`
  hangs or captures too early with the animation loop and SSE.
  - After `npm run build`, wait about 8 s before testing, because live reload (macOS FSEvents are
    slow) reloads the page mid-test.
  - Wait for `button[aria-label="Open settings"]` (the clock) before sending key presses or clicks.
- **The Pi ran at 81–83 °C (the throttle point)** with the dashboard up.
  - Cause: `backdrop-filter: blur()` on the always-on boxes (clock, Salah, verse, Background box).
    Over a canvas that changes every frame, the GPU re-blurs those areas at the full frame rate, all
    day.
  - Fix: always-on boxes use a slightly more opaque background and **no backdrop blur**. Blur is fine
    only on things that are open briefly (Settings, the pickers, the calendar views).
  - **Glass blur** in Settings turns the frosted blur back on for a Mac or PC. It's a per-device
    preference (`lib/prefs.svelte.ts`, localStorage `dashboard:glass`, off by default), never
    `dashboard.json`, so it can't reach the Pi. It works through an `html.glass` class; the System
    page stays plain either way.
  - The frame rate is 20 fps (`dashboard.json → fps`); the scenes move slowly enough.
  - The System page's GPU row shows the WebGL chip. "SwiftShader" or "llvmpipe" means Chromium fell
    back to software rendering, which runs hot.
  - **Hardware:** the Pi 5 needs the Active Cooler (or a fan case) for sustained load.
- **Fractional pattern centers:** `(x − cx) % n` with a fractional `cx` never hits 0, so the pattern
  lines vanish. Use integer anchors.
- **Svelte 5:** a variable named `state` clashes with `$state`. Instance scripts can't export
  interfaces, so put shared types in `.ts` files.

## Ideas not built yet (from planning with the user)

- Quran player extras: a sleep timer, a favourites list, a now-playing line on the other pages,
  word-by-word highlighting (needs word timings), and a Friday Al-Kahf suggestion

- Ramadan and Eid modes: lanterns, iftar/suhoor countdown, fireworks
- Friday Al-Kahf reminder; white-days reminder
- Qibla compass
- Weather-reactive scenes (Open-Meteo)
- Phone remote / settings page on the LAN
- Shared notes and grocery list
- Anniversary countdown
- A "memories" page that pixelates photos automatically
- Motion-sensor wake/sleep
- Auto slideshow
- Burn-in pixel shift
- Tasbih counter (touch)
- Spotify is built but hidden: add the `spotify` widget back to `widgets` to show it
