# Architecture

This document covers how the dashboard is put together, the technologies and tools it uses, and why each
one was chosen.

## Overview

```
┌──────────────────────── Raspberry Pi ─────────────────────────┐
│                                                               │
│  labwc (Wayland) ──autostart──▶ scripts/kiosk.sh              │
│                                     │                         │
│                                     ▼                         │
│              Chromium --kiosk  http://127.0.0.1:8080          │
│              ┌──────────────────────────────────────┐         │
│              │ Svelte UI (apps/web)                 │         │
│              │  4 Quran verse         (DOM)         │         │
│              │  3 widgets             (DOM)         │         │
│              │  2 characters  ┐  (ASCII + pixel art)│         │
│              │  1 background  ┴─▶ cell renderer     │         │
│              └───────────────┬──────────────────────┘         │
│                              │ fetch /api/*, /assets/*, SSE   │
│                              ▼                                │
│              Fastify server (apps/server)  ◀── systemd        │
│               ├─ /api/config    config/*.json (read + write)  │
│               ├─ /api/assets    list + save uploaded assets   │
│               ├─ /api/events    live reload (file watcher)    │
│               ├─ /api/prayer    adhan (offline calculation)   │
│               ├─ /api/quran     assets/quran/quran.json       │
│               ├─ /api/recitation  Quran player (mpv)          │
│               ├─ /api/spotify   OAuth + Web API proxy         │
│               ├─ /assets/*      assets/ (art, fonts, Quran)   │
│               └─ /*             apps/web/dist (built UI)      │
└───────────────────────────────────────────────────────────────┘
```

The whole app is a **local web app**. A small Node server runs on the Pi, and Chromium displays it
full-screen. The browser handles drawing on the GPU. The server handles secrets, files, and background
work. Nothing depends on the Mac at runtime.

## Technology stack

### Runtime and display

| Tool | Role | Why |
|---|---|---|
| **Raspberry Pi OS Bookworm (64-bit)** | Operating system | Current official OS. It ships labwc (Wayland) and a GPU-accelerated Chromium. |
| **labwc** | Wayland compositor | `~/.config/labwc/autostart` starts the kiosk on login. |
| **Chromium (`--kiosk`)** | Display | Full-screen with no window chrome, and WebGL2 on the Pi's GPU. The same code runs in any browser. |
| **systemd** | Process manager | Starts the server on boot and restarts it if it crashes (`deploy/rpi-dashboard.service`). |
| **Node.js 22 LTS** | Server runtime | TypeScript on both server and UI. The built-in `--env-file` flag loads `.env`. |

### Frontend (`apps/web`)

| Tool | Role | Why |
|---|---|---|
| **Svelte 5** (runes) | UI components | Tiny runtime, which suits a Pi. Each widget is one component. |
| **Vite** | Dev server and bundler | Hot reload, and a multi-page build (dashboard + importer). Proxies `/api` and `/assets` in dev. |
| **TypeScript** | Language | Typed config, asset formats, and widget contracts. |
| **WebGL2** | Main renderer | One full-screen shader pass. The CPU uploads only `cols×rows×4` bytes per frame: the glyph, plus 12-bit foreground and background color ids packed into the other three bytes. |
| **Canvas 2D** | Fallback renderer | Used if WebGL2 is unavailable. Tinted atlases per color, and only changed cells are redrawn. |
| **gifuct-js** | GIF decoding | The uploader composites GIF frames, then converts them to ASCII or quantizes them to a small palette for pixel art. |

### Backend (`apps/server`)

| Tool | Role | Why |
|---|---|---|
| **Fastify** | HTTP server | Fast and small, with one plugin per route file. |
| **@fastify/static** | Static hosting | Serves the built UI and `assets/`. |
| **tsx** | Dev runner | Runs TypeScript directly and restarts on file changes. |
| **adhan** | Prayer times | Offline astronomical calculation. Supports methods (NorthAmerica/ISNA, MWL, UmmAlQura, …) and Shafi/Hanafi Asr. |
| **Server-sent events** | Live reload | `fs.watch` on `config/`, `assets/` and `dist/` broadcasts `reload` to open pages. |

### Data and external services

| Source | Used for | Notes |
|---|---|---|
| **Tanzil Uthmani text** via alquran.cloud | Quran Arabic | Stored unmodified in `assets/quran/quran.json`. For display, the server splits the basmala off ayah 1 of each surah. |
| **Sahih International** | Translation | Swap with `npm run fetch-quran -- <edition>`. |
| **mp3quran.net** (read 217, Shaykh Bandar Baleela) | Quran recitation | One MP3 per surah, streamed on first play and saved in `data/quran-audio/`. The ayah timings are in `assets/quran/recitation.json` (`npm run fetch-recitation`), checked against `quran.json`. The server plays it through `mpv`, so a page reload doesn't interrupt it. |
| **Spotify Web API** | Now playing and controls | Authorization Code flow with the secret kept on the server. Tokens are in `data/spotify.json` (gitignored). Album art is proxied so the UI can read pixels for the ASCII thumbnail. |
| **Google Calendar (secret iCal link)** | Personal calendar on the Haram page | Read-only; no OAuth. Parsed with `ical.js` (no dependencies), including repeating events. The link stays in `.env` and is never sent to the browser. |
| **Gmail API** *(later)* | Unread mail widget | Same OAuth pattern as Spotify. |

### Fonts (bundled in `assets/fonts/`, OFL)

| Font | Use |
|---|---|
| **JetBrains Mono** | The ASCII grid, the widgets, and the glyph atlas |
| **Amiri Quran** | Arabic verse text, including the `۝` end-of-ayah mark with Arabic-Indic numerals |

### Tooling

| Tool | Role |
|---|---|
| **npm workspaces** | One install for `apps/web` and `apps/server` |
| **concurrently** | `npm run dev` runs both apps in one terminal |
| **svelte-check / tsc** | `npm run check` |
| **git / rsync + ssh** | `npm run update` (on the Pi) or `npm run deploy` (from the Mac) |
| **Playscii, REXPaint** | Drawing ASCII art by hand |
| **scripts/art/** | Code-generated pixel art (`npm run art`) |

## Rendering pipeline

Everything on the canvas is text cells, and each cell has a **glyph, a foreground color and a background
color**. That one model covers both styles:

- **ASCII art:** characters such as `.-~=≈` or `/^\\`, colored by foreground.
- **Pixel art:** the half-block trick. Glyph `▀` with fg = the top pixel and bg = the bottom pixel gives
  two stacked "pixels" per cell. With 10×18 cells those pixels are nearly square (10×9).

```
scene.draw(grid, t)                              renderer.draw(grid)
┌──────────────────────────────────────┐         ┌─────────────────────────────────────┐
│ grid.clear(), pixels.clear()         │         │ upload grid → RGBA8 texture         │
│ background.draw  (sunset → pixels,   │         │ fragment shader, per pixel:         │
│                   water  → grid)     │ ─Grid─▶ │   cell = floor(px / cellSize)       │
│ pixel sprites    → pixels            │ 3×Uint8 │   glyph, fg, bg = cells[cell]       │
│ pixels.resolve() → ▀/▄ cells         │ per cell│   α = atlas[glyph][px in cell]      │
│ ASCII sprites    → grid (keep bg)    │         │   out = mix(palette[bg],            │
│ background.overlay (ASCII motes)     │         │             palette[fg], α)         │
└──────────────────────────────────────┘         └─────────────────────────────────────┘
```

- **Grid** (`renderer/grid.ts`): the glyph of each cell (`Uint8Array`) and its foreground and background
  color ids (`Uint16Array`, 12-bit). `set()` keeps the background, so ASCII text can sit on top of pixel art.
- **PixelLayer** (`scene/pixels.ts`): a `cols × rows·2` buffer of palette ids. `resolve()` folds each
  vertical pair into one cell:
  - same color → an empty cell with that background
  - two colors → `▀`
  - only the top or only the bottom pixel set → `▀` or `▄`, over whatever was there before
- **GlyphSet / Palette** (`renderer/glyphs.ts`): assign ids to characters and colors as they are first
  used. There can be up to 256 glyphs and 4,096 colors. Every page shares one palette, so four detailed
  pixel-art pages together easily pass 256 colors. The palette is uploaded as a 64×64 texture. When a set grows, the renderer rebuilds the atlas or palette texture.
- **Glyph atlas:** each character is drawn once, white on transparent. Block characters (`█▀▄▌▐`) are
  filled as exact integer rectangles so the pixels tile without seams.
- **Loop** (`renderer/loop.ts`): `requestAnimationFrame`, capped at `config.fps`. Scene plus upload takes
  about 0.3 ms per frame on a laptop. Add `?debug` to the URL to see this on the device.
- **Sizing:** `grid.rows` (60) fixes the composition. Cells scale with the screen, so a 7" 800×480 panel
  shows the same picture as a 1080p TV (1080p is 192×60 cells, or 192×120 pixels).
- **Widgets and verse** are ordinary HTML over the canvas. That keeps the text crisp and lets Chromium
  handle Arabic shaping.

### Scene pieces (`apps/web/src/scene`)

- `backgrounds/sunset.ts` is the Al-Aqsa sunset, drawn in pixels.
  - The static parts are rendered once per screen size and copied each frame:
    - a sky gradient with 4×4 Bayer ordered dithering between color stops, brightened in a halo around
      the sun
    - the sun disk and two layers of hills
    - the Old City skyline, generated from hashed houses and domes with lit windows
    - the stone plaza, with perspective joints converging on a vanishing point
  - The animated parts are clouds, birds, twinkling stars, and ASCII dust motes drawn by `overlay()`.
- `backgrounds/haram.ts` is Masjid al-Haram from above at night, drawn in pixels.
  - It uses nested superellipses: the outer complex, the Ottoman arcade band and the inner courtyard.
    Distances are corrected for the pixel shape (A = 1.11), so circles stay round.
  - Static parts:
    - tiled rooftops with skylights
    - an arcade of shaded 4×4 domes with lit arches
    - the floodlit marble courtyard and the mataf bridge ring
    - the Kaaba, with its gold band
    - radial roads, city blocks with windows, and value-noise mountains
    - round glows for the minarets and the clock tower
  - Animated parts: about 900 pilgrims orbiting counter-clockwise (tawaf), with angular speed ∝ 1/r and
    denser rings near the Kaaba; Hijr Ismail and Maqam Ibrahim drawn on top of the crowd; flickering
    city lights; and pigeons.
- `backgrounds/madinah.ts` is Masjid an-Nabawi from the plaza by day.
  - The plaza is drawn by **inverse perspective projection**. Each floor pixel maps to ground
    coordinates: `v = D / (y − y_horizon)` (distance) and `u = (x − cx)·v / F` (sideways).
  - Everything on the floor is defined in those ground coordinates:
    - the tile grid
    - the granite bands at fixed `u` / `v`
    - the central walkway
    - the diamond inlays, drawn as bands of `|u−u₀| + k|v−v₀|`
  - A line pixel is drawn wherever a boundary falls between a pixel and its neighbor, so line widths
    stay correct at every depth.
  - Lamp posts and people are placed on the ground and projected, with size ∝ 1/v, and are drawn far
    to near.
  - The rest is static: the minarets (balconies, gold and green tips), the Green and silver domes with
    their shading, the arcaded front, the umbrella canopy arches, the kiosks, the hotels and the hills.
    Clouds drift only over sky pixels.
- `backgrounds/farooq.ts` is the Masjid Al-Farooq arch.
  - The arch is a pointed shape with half-width `W·(1 − t²)^1.1`, which gives rounded shoulders and a
    point at the top. A white marble border surrounds a diamond mosaic.
  - The mosaic is a lattice on `x+y` and `x−y`, with light grout, dark dots at the crossings, and
    hashed stone colors per tile. The tiles are about 9 px, large enough that pixel diamonds don't read
    as `+` signs.
  - Inside is a pointed inner arch with a veined marble panel and a black rail.
  - Around it: cream brick in running bond with bench slabs, a red brick planter, noise-shaped trees, a
    smooth-noise overcast sky and a stone deck.
  - ASCII petals drift down in `overlay()`.
- `backgrounds/meadow.ts` is a Kazakh mountain meadow in spring. It has noise ridges (snow-capped peaks
  shaded by smoothed slope, spruce slopes with tree texture, and bushy green hills), a meadow with grass
  blades and dandelions, and a winding dirt path. Clouds drift over sky pixels only, grass tips sway, and
  dandelion seeds float up as ASCII in `overlay()`.
- `backgrounds/water.ts` is the ASCII night scene. It has:
  - hashed stars that twinkle
  - a shooting star
  - water from three summed sine waves, with perspective
- `backgrounds/frames.ts` plays imported backgrounds, either ASCII or pixel art, stretched to the screen.
- `characters.ts` handles sprites.
  - **Pixel sprites** (the asset has a `palette`) draw into the pixel layer.
  - **ASCII sprites** draw into the grid and support these options:
    - `solid`: a flood fill from the edges finds spaces enclosed by the outline, and those become opaque
    - `reflect`: a rippling reflection in the water
    - `flip`
- To add a new procedural effect (rain, snow, aurora), write a function that returns
  `{ draw(grid, t, pixels), overlay? }` and register it in `backgrounds/index.ts`.

### Pages, prayer-time scenes and transitions

- `dashboard.json → pages` lists the pages. Each page has either a `scene`, or a `sceneByPrayer` map
  (`fajr`, `dhuhr`, `asr`, `maghrib`, `isha`), plus flags for widgets and the verse. `App.svelte` loads
  **every** scene up front into one flat list, and maps each page (and prayer) to an index in it.
- `lib/prayerClock.ts` keeps the latest `/api/prayer/today` data.
  - `currentPeriod()` returns the prayer period. Fajr runs until Dhuhr, and Isha until the next Fajr.
  - `dawnProgress()` gives the Fajr sunrise progress, from 0 at Fajr to 1 about 20 minutes after
    sunrise.
  - URL parameters (`?prayer=`, `?dawn=`, `?banner`) override both for previews.
- `App` re-checks the period every 20 s. When it changes, the home page's `active` scene changes.
  `AsciiScene` receives `scenes`, `active` and `dir`, and plays the wipe whenever `active` changes.
- `AsciiScene.svelte` builds every scene with one **shared** `GlyphSet` and `Palette`, so the ids mean
  the same thing in every scene's grid. Each scene clears its grid to its own theme background.
- **Pixel wipe:** while a transition runs (900 ms, ease-in-out), both scenes draw into their own grids.
  They are combined cell by cell. A cell shows the incoming scene once the sweep front has passed
  `x + jag·hash(x, y)`, which gives a jagged edge. A band of `█▓▒░` in the incoming scene's accent
  color marks the edge.
- **Picking a scene:** the Salah widget's prayer rows are buttons. Tapping one sets `view.selected` in
  `lib/viewState.svelte.ts`, a Svelte 5 `$state` module shared by the widget and `App`. `App` shows
  `view.selected ?? period.prayer`. The widget colors the live prayer yellow and the picked one light
  blue. The selection clears when it's tapped again, when the live row is tapped, or when the real
  prayer period changes.
- **Settings and scenery mode:** tapping the clock opens `components/Settings.svelte`. Scenery mode hides
  every overlay, and `active` comes from a gallery of all scenes (`GET /api/config/scenes`), stepped by
  left or right taps. A faint ✕ exits. The two toggles save `dashboard.json`, and live reload applies
  them.
- **Navigation:** tapping the right or left half of the screen goes next or previous. Taps on buttons,
  panels or the verse are ignored. Widgets can also call `navigate('next')` in `lib/pages.ts`, which fires a window event.
  `App.svelte` also handles arrow keys, horizontal swipes, and taps on pages without widgets.
  Navigation is debounced for the length of the transition.
- **Layout:** the widget grid's columns are `auto minmax(0, 1fr) auto`. The Quran verse and the prayer
  banner live in the **top-center** cell. The verse's top lines up with the side boxes, and it can only
  use the space between them.
- **`PixelTitle.svelte`** (the prayer banner, the Hijri date, and the month in the calendar):
  1. It rasterizes the title and a subtitle onto a small canvas. Arabic uses Amiri Quran and flies in
     right to left; Latin uses JetBrains Mono and flies in left to right. The subtitle sits below
     the Arabic's lowest descender.
  2. Each opaque pixel becomes a particle that flies in from the sky along an arc, right to left for
     the Arabic.
  3. Once settled, a gold light sweeps across, with a pixel drop shadow and twinkles.
  4. It runs at 30 fps while assembling and 15 fps afterwards.

  Its `subtitle` reads "TIME FOR ASR" for the first 12 minutes, then "ASR · 4:52 PM" when
  `prayer.showCurrent` keeps it up. `boxed` gives it the verse's frosted box, used when the verse is
  off, so it takes the verse's place. `maxWidth` makes the pixels smaller so it fits a narrow panel.
- **System page:** `GET /api/system` returns static info (model, OS, kernel, git commit), the
  latest sample, and 30 minutes of history. `services/system.ts` samples in the background from
  `/proc`, `/sys`, `vcgencmd` and `ps`. The page polls every 3 s and adds the renderer's own FPS
  from `lib/renderStats.ts`.
- **Haram page calendars:** the page has its own `widgets` list (`islamic-calendar`, `calendar`), in
  the `rooftop-left` and `rooftop-right` areas. These are centered on the scene's rooftop bands, and
  both cards share `SideCard.svelte`.
  Tapping a card sets `view.expanded`, which opens a 33vw view from that side, short of the mataf.
  Hijri dates and events come from `lib/hijri.ts` (Intl Umm al-Qura, offline). Personal events come
  from `GET /api/calendar/events`.

### The five prayer scenes

| Prayer | Effect | Notes |
|---|---|---|
| Fajr | `sunset.ts` with `dawn: true` | The pre-dawn and sunrise palettes are blended in 8 steps by `dawnProgress()`. The base is rebuilt when the step changes. The sun climbs from below the hills. Stars fade. Windows go dark as it gets light. |
| Dhuhr | `kaaba.ts` | Midday sky, two minarets, the Ottoman arcade (domes, gold arches) and the white expansion (arch tiers, gold medallions, lamp poles). The kiswa has a woven texture, the gold hizam, panels, the door and the white lower wrap. White marble with circular bands. Three rows of pilgrims: the back row drifts (tawaf), the front rows stand. |
| Asr | `sophia.ts` | Warm sky with clouds. The great dome with a window ring on its drum, half-domes, rose walls and buttresses, the red arch with its window grid, lower domes, 4 Ottoman minarets (cream and brick-banded), palms, pavement, and a dark gateway frame. People walk behind the frame mask. |
| Maghrib | `madinah.ts` with `time: 'sunset'` and `openUmbrellas` | Sunset colors replace the daytime ones. The sun sits low over the city, and the lamps stay lit. The open umbrellas are projected like the lamp posts: tall columns carrying tented canopies (ribs, drooping corners, a sunset-lit underside), depth-sorted with the posts and people, and placed clear of the Green Dome. |
| Isha | `farooqNight.ts` | Starry sky with a crescent moon. The floodlit masjid (5-arch arcade, tower with a tripartite window, copper dome, small minaret, right wing with windows and a wooden door). A star-shaped fountain with a jet and sparkles. Canopy tents (striped, lit, with goods), queues at each tent, walkers, string-light catenaries with twinkling bulbs, and steam. |

### Pixel-art generator (`scripts/art/`)

The Al-Aqsa scene assets are drawn by code rather than by hand. `lib.mjs` provides a small canvas of
palette keys with helpers:

- `rect` and `span` for filling areas
- `shade`, which picks a light level with dithered edges
- `bayer` and `hash`

`aqsa.mjs` builds each piece from shapes. Examples:

- **Dome of the Rock:**
  - a pointed dome shaded by angle to the light
  - a tiled drum with windows
  - three octagon faces shaded differently: lit, front and in shadow
  - a band of inscription, arched windows and a glowing portal
- **The two figures:**
  - the keffiyeh uses a fishnet pattern, `(x+y)%3` and `(x−y)%3`
  - the tatreez uses repeating stitch motifs
  - small frame differences let the fabric move in the wind
  - the faces are plain ovals of skin tone

`horses.mjs` draws the couple on horseback. The parametric horse (barrel, chest, hindquarters, neck,
lowered head, mane and tail) has a 4-frame walk cycle for the legs and a pixel-art outline pass.

`couple.mjs` draws the two of them for the prayer scenes: one body template, with five outfits each
(palestine, hajj, turkey, saudi, atlanta).

`wedding.mjs` draws the wedding couple in the same way:

- the groom's bisht with broad gold embroidery, the headband checker, and the bouquet with roses,
  baby's breath, gold-leaf branches drawn as lines, a vase and a red ribbon
- the bride's dupatta, with an embroidered ring framing the face, the maang tikka, and a dress with
  motifs and an embroidered hem

`npm run art` rewrites the JSON in `assets/characters/`.

## Asset formats

### Character (`assets/characters/<name>.json`)

An ASCII character is rows of text, where spaces are transparent:

```json
{
  "name": "lantern", "fps": 3, "solid": true,
  "frames": [["  |", " _|_", "/___\\", "|:*:|", "\\___/"], ["…next frame…"]]
}
```

A pixel-art character has a `palette`. Each character in the rows is a color key, and `.` is transparent.
Every text row is 2 pixels tall:

```json
{
  "name": "keffiyeh-man", "fps": 1.2,
  "palette": { "K": "#efe9dc", "k": "#26222b", "A": "#141117", "F": "#d8a27a" },
  "frames": [[".......KKkKK.......", "......AAAAAAA......", "…"]]
}
```

### Background (`assets/backgrounds/<name>.json`)

A procedural background names an effect and its parameters:

```json
{ "name": "aqsa-sunset", "type": "procedural", "effect": "sunset",
  "params": { "horizon": 0.64, "sunX": 0.5, "sunY": 0.57, "clouds": 6, "birds": 5, "skyline": true, "motes": 14 } }
```

The `sunset` effect also accepts `sky` and `ground` color-stop arrays. The `water` effect accepts
`speed`, `horizon`, `ramp`, `stars`, `starRamp` and `shootingStars`.

A frame-based background, which the uploader creates, is ASCII with a `ramp`, or pixel art with a
`palette`:

```json
{ "name": "rain", "type": "frames", "fps": 12, "palette": { "A": "#1a1438" }, "frames": [["AAAA…"]] }
```

### Scene (`config/scenes/<name>.json`)

```json
{ "theme": "sunset", "background": "aqsa-sunset",
  "characters": [{ "asset": "dome-of-the-rock", "x": 0.31, "y": 0.84, "anchor": "bottom-center" }] }
```

`dashboard.json → scene` holds either a scene name or an inline scene object. A scene's `theme` overrides
the dashboard theme.

### Theme (`config/themes/<name>.json`)

Holds the color tokens (`background`, `foreground`, `accent`, `muted`, `verse`), used as CSS variables
and by the renderer. `colors` holds extra named colors for ASCII sprites. `ramp` is the default
brightness ramp.

## Widget contract

```
apps/web/src/widgets/<id>/
  manifest.ts     export default { id, name, component }
  Widget.svelte   receives `options` from config/dashboard.json → widgets[].options
```

`widgets/registry.ts` maps ids to manifests. `App.svelte` places each widget from the config into one of
eight grid areas. Widgets wrap their content in `Panel.svelte`, which draws the Omarchy-style box with the
title set into the top border.

To add a widget (Gmail, for example):

1. Create the folder.
2. Add a server route under `apps/server/src/routes/` if the widget needs secrets.
3. Register the route in `index.ts`.
4. Add one line to `registry.ts`.
5. List the widget in `config/dashboard.json`.

## HTTP API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check (used by `kiosk.sh`) |
| GET / PUT | `/api/config` | Read or replace `dashboard.json` |
| GET / PUT | `/api/config/scenes/:name` | Read or replace a scene file |
| GET | `/api/config/themes/:name` | Theme JSON |
| GET / POST | `/api/assets`, `/api/assets/:kind` | List assets, or save a `character` or `background` |
| GET | `/api/events` | SSE stream that emits `reload`, and `recitation` (the Quran player's state) |
| GET | `/api/prayer/today` | Today's times, the next prayer, the current prayer |
| GET | `/api/quran/random`, `/api/quran/:surah/:ayah` | A verse with its translation |
| GET | `/api/recitation`, `/api/recitation/surahs` | The Quran player's state (with the ayah being recited), and the surah list |
| POST | `/api/recitation/play\|pause\|resume\|stop\|mode\|volume` | Player control. `play` takes `{ surah, ayah? }`. |
| GET | `/api/spotify/login`, `/callback` | OAuth |
| GET | `/api/spotify/now-playing`, `/art?url=` | Playback state, and the album-art proxy |
| POST | `/api/spotify/play\|pause\|next\|previous` | Playback control |

The server listens on `127.0.0.1` only. Nothing is exposed to the network unless you set `HOST=0.0.0.0`.
To reach it from another machine, use an SSH tunnel.

## Configuration and secrets

| File | Contents | Committed? |
|---|---|---|
| `config/dashboard.json` | Scene, theme, widgets, verse and prayer settings | Yes |
| `config/scenes/*.json` | Scene compositions | Yes |
| `config/themes/*.json` | Palettes | Yes |
| `assets/**` | Art, fonts, Quran data (uploads land here too) | Yes |
| `.env` | Location, API keys, deploy target | **No** |
| `data/` | Spotify tokens, saved surah audio, the Quran player's place | **No** |

## Dev vs. production

| | Development (Mac) | Production (Pi) |
|---|---|---|
| UI | Vite on `:5173`, hot reload | `apps/web/dist`, served by Fastify |
| Server | `tsx watch` on `:8080` | `node dist/index.js` under systemd |
| Display | Any browser | Chromium kiosk from labwc autostart |

Vite outputs its bundle to `/_app/` so that `/assets/` stays reserved for the dashboard's own assets.
