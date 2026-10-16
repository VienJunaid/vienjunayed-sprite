# Journey scene (horse travelling mode)

A side-scrolling scene for the dashboard: the couple ride on horseback in the bottom-left corner
while the world scrolls right to left, from Al-Aqsa to Makkah to Madinah to Istanbul and round again.
Built and tested in `dashboard-sandbox/` only. Nothing in `~/Tools/rpi-dashboard` has been changed.

This file is the hand-over for adding it to the real rpi-dashboard.

## What it looks like

One loop is 2 minutes, 30 seconds per stop. The day runs with the ride.

| Stop | Light | Landmark | Ground | Him | Her |
|---|---|---|---|---|---|
| Al-Aqsa | Dawn, sun rising | Dome of the Rock, Qibli mosque, minaret, cypress, olive | Worn stone slabs | White thobe, black-and-white keffiyeh, dappled grey | Black thobe with red tatreez, white veil, white horse |
| Makkah | Noon, sun high | The Kaaba, white arcades, minarets | Rippled sand | Plain white, bare head, chestnut | Black abaya, full black niqab, palomino |
| Madinah | Sunset | Green Dome, white walls, minarets | Two-tone pink tiles | White thobe, red shemagh and agal, black horse | Black abaya with gold trim, bay |
| Istanbul | Night, stars, crescent | Hagia Sophia, windows lit | Cobbles | Navy kaftan with gold, palomino | Camel coat, turquoise scarf, chestnut |

- **Layers, slowest to fastest:** sky and sun, far hills (0.2), landmark (0.45), roadside trees and
  lamps (0.75), ground (1.0; nearer ground rows scroll faster than far ones).
- **Changing stop:** the new ground sweeps in from the right as one upright ragged edge. When it
  reaches the riders their clothes and horses dissolve into the next look over 2 seconds. The sky and
  the far hills blend over the last 8 seconds of a stop.
- **Birds** by day, stars and a crescent by night. The night stop runs back into dawn, so the loop
  has no cut.
- **Project rules kept:** faces are plain, she wears hijab at every stop, the niqab is solid black.

## See it in the sandbox

```bash
cd ~/Projects/vienjunayed-sprite/dashboard-sandbox
npm start                      # sandbox runs on port 8090, not 8080
```

- Riders only: `http://127.0.0.1:8090/?scene=journey`
- Stills of the whole loop: `lab/out/journey-sheet.png`
- As the home background with the boxes on top: `lab/out/journey-home.png`

## The two modes

Both already work in the sandbox through rows that Settings has today (tap the clock, top left):

| Mode | What stays on screen | How to get there today |
|---|---|---|
| **1. Journey as home** | Clock, Salah box, Quran verse box, prayer banner | Settings → Home background → Journey → Save |
| **2. Travellers only** | Nothing but the art | Settings → Scenery mode, then step the Scene row to Journey |

Mode 1 was checked in the sandbox by previewing Journey through the Home background picker (not
saved, so the sandbox's `dashboard.json` is unchanged). Mode 1 writes `pages[0].sceneOverride =
"journey"`; "Follow prayer times" in the same picker undoes it.

### Proposed for the real dashboard: one Settings row

To make it one tap instead of a hunt through the scene list, add a row to
`components/Settings.svelte`. This is not built yet.

```
Horse journey
The couple ride from Al-Aqsa to Makkah, Madinah and Istanbul.
                                   [ with clock & prayers ]  [ riders only ]
```

- **with clock & prayers:** `save((c) => (c.pages[0].sceneOverride = 'journey'))`. When it is
  already set, the button reads "back to prayer times" and deletes the override.
- **riders only:** set `view.scenery = true` and start the gallery on `journey`. `App.svelte`
  already does this for `?scene=<name>` (it sets `galleryIndex` from the scene name), so the
  cleanest way is a small `view.sceneryStart: string | null` that the same code reads.

## Files to bring over

Paths are relative to the dashboard repo. The sandbox copy has every one of them.

**New files**

| File | What it is |
|---|---|
| `apps/web/src/scene/backgrounds/journey.ts` | The scene: layers, stops, landmarks, riders |
| `scripts/art/horses-journey.mjs` | Generates the eight rider sprites (run with `node`) |
| `assets/characters/rider-{him,her}-{aqsa,makkah,madinah,istanbul}.json` | Generated output of the script above |
| `assets/backgrounds/journey.json` | `effect: journey` and its params |
| `config/scenes/journey.json` | Theme, background, and the assets to load (all `hidden`) |
| `config/themes/journey.json` | UI colours for the boxes |

**Small edits to existing files**

| File | Change |
|---|---|
| `apps/web/src/scene/backgrounds/index.ts` | Import and register `journey`; `createBackground` and the effect type take a third argument, the scene's loaded character assets |
| `apps/web/src/scene/scene.ts` | Pass `assets.characters` to `createBackground`; skip characters marked `hidden` |
| `apps/web/src/lib/types.ts` | `SpriteConfig.hidden?: boolean` |

Why `hidden`: the scene draws the riders and the Al-Aqsa buildings itself, so that the riders can
change look and the buildings can scroll. It still needs their asset files loaded, and the app only
loads assets a scene lists under `characters`. `hidden` means "load it, do not place it".

**Do not bring over with it** (other sandbox experiments in the same files):

- `scene.ts` `tap()`, `characters.ts` `hit`/`play`, `AsciiScene.svelte` click handler, and
  `CharacterAsset.actions` in `types.ts`: these are click-to-wave.
- `App.svelte` and `Settings.svelte` navigation changes (scene changes only from Settings, the ⚙).
- The `*-alive`, `*-sways`, `*-wave` character files and the `-alive` names in the prayer scenes.
- `config/scenes/lab-maghrib-empty.json` (a test background) and `PORT=8090` in `.env`.

After copying: `npm run check` (0 errors, 0 warnings in the sandbox), `npm run build`, then add the
scene to `CLAUDE.md`'s scenery list, as that file asks.

## Tuning

| What | Where |
|---|---|
| Seconds per stop, ground speed, number of birds | `assets/backgrounds/journey.json` (`stopSeconds`, `speed`, `birds`) |
| Sky, sun, cloud, hill, ground and bird colours per stop | `STOPS` at the top of `journey.ts` |
| Layer speeds | `LAND`, `PROP`, `FAR` in `journey.ts` |
| Where the riders stand | The two `rider(...)` calls at the end of `draw` (x as a fraction of the width) |
| Landmark drawings | `buildLandmarks()` in `journey.ts` |
| Outfits and horse coats per stop | `STOPS` at the bottom of `horses-journey.mjs` |
| Horse and rider shape | `horse()`, `him()`, `her()` in `horses-journey.mjs` |

Adding a stop means one entry in each `STOPS` table, a landmark in `buildLandmarks()`, a ground
texture and far-ridge shape in `draw`, and a prop set in `buildProps()`.

## Horse and rider shape (second pass)

The first riders reused the Kazakh horse: a large rump on thin 2 to 3 pixel legs, and block-shaped
riders. Changed in `horses-journey.mjs` only; `horses.mjs` and the Kazakh scene are untouched.

- **Horse:** legs are 5 pixels longer, with a tapered upper leg (wider behind), a 3 pixel cannon
  bone, a fetlock and a wider hoof with the toe forward. The hindquarters are smaller and the chest a
  little deeper, so the body no longer outweighs the legs.
- **Him:** square shoulders tapering to the waist, an upper arm and forearm bent at the elbow, a
  thigh lying forward over the saddle, a shin, and a boot in a stirrup.
- **Her:** shoulders and a narrower waist, a bent sleeve, a fuller skirt with folds, a foot in the
  stirrup.
- The saddle and reins are drawn before the rider, so legs and skirts lie over them.

## Known limits

- **Cost.** About 6 ms of scene work per frame, against 1.4 to 1.7 ms for `kazakh-meadow` and
  `madinah-maghrib` in the same test (headless Chrome, software rendering, this laptop). The
  project's budget in `CLAUDE.md` is under 1 ms on a laptop because the Pi is about ten times
  slower. The sky, far ridge and ground are redrawn in full every frame. Before this goes on the Pi
  it needs the usual treatment: build the static parts once and scroll them.
- **Landmarks.** Only Al-Aqsa uses the existing art. The Kaaba, Madinah and Hagia Sophia are new,
  simpler drawings and are the weakest part. Their minarets are thin poles with balcony bars, which
  `CLAUDE.md` warns can read as crosses at small sizes; they want domes or cones.
- **Not seen in motion by the author.** It was checked through stills at eight points of the loop
  and one mid-change frame. Headless capture here runs at about 5 to 8 frames a second.
- **Riders are not interactive.** The scene draws them, so click-to-wave does not apply here.
- **Makkah outfit.** He is in plain white rather than a drawn two-cloth ihram.
- **Wallpaper.** The live-wallpaper videos are 60 second loops. This loop is 120 seconds, so a
  wallpaper version needs a 2 minute render or `stopSeconds: 15`.
- **Screen size.** Drawn for the dashboard's 192 x 120 pixel grid. Wider screens show more world;
  nothing is scaled.
