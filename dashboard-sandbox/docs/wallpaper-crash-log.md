# Live wallpaper (hyprwinwrap) crash log

Working log for getting docs/omarchy.md step 6 (live animated wallpaper) stable. Updated as we go so
a Hyprland crash doesn't lose the context. Newest entries at the bottom.

## Root cause (found 2026-09-29)

Hyprland crashed with `SIGSEGV` inside the `hyprwinwrap` plugin's `onConfigReloaded()` hook — it
reads a Hyprland config value (`Config::Values::CStringValue::value()`) on every config reload, and
that call segfaulted. Evidence: `~/.cache/hyprland/hyprlandCrashReport1452.txt` (crashed 2026-09-29
04:23 EDT).

`hyprwinwrap` was installed by hand as a `.so` dropped straight into
`~/.local/share/hyprwinwrap/libhyprwinwrap.so`, **not** through `hyprpm` (the tool
`docs/omarchy.md` step 6 actually calls for). `hyprpm` builds a plugin against the exact Hyprland
headers/ABI installed on the machine; a hand-built/hand-copied `.so` can drift out of sync the
moment Hyprland updates, which is almost certainly what happened here.

## State at investigation time (2026-09-29, ~04:45 EDT)

- Hyprland running fine since 04:41, no crash since.
- `~/.local/share/hyprwinwrap/libhyprwinwrap.so` had already been rebuilt once (mtime 04:38, by an
  earlier session) — its embedded commit hash now matches the running Hyprland
  (`efb50993780079460b0cbed1363e2166a2de1d9f`), and `ldd` resolves all its shared-lib deps cleanly.
- Despite that, `hyprctl plugins list` → **"no plugins loaded"**, even though
  `~/.config/hypr/wallpaper.conf` still has `plugin = .../libhyprwinwrap.so` and is sourced from
  `~/.config/hypr/hyprland.conf`. No log line anywhere about it loading or failing to load. The
  `rpi-wallpaper` Chrome window isn't running either.
- `hyprpm` is not installed as a command. It exists half-built in `~/.cache/yay/hyprpm-git/`
  (an AUR package that builds the `hyprpm` binary out of the main Hyprland source tree — it is
  **not** part of `hyprwm/hyprland-plugins`, it's a CMake target inside `hyprwm/Hyprland` itself).
  It was never installed because `pacman`'s keyring is broken on this machine:
  ```
  warning: Public keyring not found; have you run 'pacman-key --init'?
  error: asahi-alarm: key "12CE6799A94A3F1B5DDFFE88F576553597FB8FEB" is unknown
  error: keyring is not writable
  error: database 'asahi-alarm' is not valid (invalid or corrupted database (PGP signature))
  ```
  This blocks *all* pacman operations on the machine, not just this one — it's a pre-existing
  system issue we're incidentally fixing.

## Plan (chosen: option 2 — fix the proper way)

1. Fix the pacman keyring (`pacman-key --init`, populate `archlinuxarm`) — needs sudo password, so
   Vien has to run this himself.
2. Build and install `hyprpm` from the AUR package already cached at `~/.cache/yay/hyprpm-git/`.
3. Use `hyprpm` to add the `hyprwm/hyprland-plugins` repo and build+install `hyprwinwrap` the
   sanctioned way, so it's compiled against this exact Hyprland build.
4. Remove/replace the manually-dropped `.so` and the manual `plugin =` line in `wallpaper.conf` with
   whatever `hyprpm` sets up.
5. Test carefully (small, reversible step) before trusting it on the live session.

## Rollback if this goes wrong

- `~/.config/hypr/wallpaper.conf`: comment out the `plugin =` line and the two
  `plugin:hyprwinwrap:*` blocks — Hyprland will just skip the wallpaper window, nothing else breaks.
- `~/.config/hypr/autostart.conf`: comment out the `google-chrome-stable --class=rpi-wallpaper`
  exec-once line so the wallpaper Chrome window stops launching.
- Neither touches the regular dashboard service/app (`rpi-dashboard.service`, `SUPER+D`), which is
  unaffected either way.

---

## Running log

- **04:45** — Investigation complete, root cause identified, this file created. Blocked on Vien
  running the pacman-key fix (needs sudo password, can't be done non-interactively).
- **Later** — Vien ran `sudo pacman-key --init` and `sudo pacman-key --populate archlinuxarm`.
  Confirmed the earlier "Public keyring not found" warning is cosmetic/benign for plain `pacman -Q`
  local-DB queries even before the fix (tested against a known-good package, `bash`, which resolved
  fine despite the warning) — so `-Qo hyprpm` saying "No package owns hyprpm" was always the correct,
  real answer (hyprpm was never installed), not a symptom of a broken keyring blocking us.
  `yay` (v13.0.1) is available. Next: install `hyprpm` for real via
  `yay -S hyprpm-git` (source already cloned at `~/.cache/yay/hyprpm-git/`, deps still missing:
  `hyprland-protocols-git`, `glaze`, `meson`). This needs interactive sudo + AUR build, so Vien needs
  to run it himself; I'll pick up once it's done.
- **04:49** — Vien ran `yay -S hyprpm-git`. **Do not repeat this** — it cascaded badly:
  `hyprpm-git`'s PKGBUILD depends on `hyprland-git` (not the installed `hyprland` repo package), so
  yay tried to rebuild a huge chunk of the Hyprland stack from AUR: `hyprland-git`,
  `hyprcursor-git`, `hyprland-guiutils-git`, `hyprwire-git`, `hyprtoolkit-git`, `udis86-git`.
  Failures: `udis86-git` isn't available on aarch64 at all; `hyprtoolkit-git` conflicts with the
  already-installed `hyprtoolkit-0.5.4-6` (required by `hyprland-guiutils`); the repo package
  `glaze-8.4.0-1` 404'd from `mirror.archlinuxarm.org`. Nothing was actually changed/broken —
  every layer failed and rolled back — but don't rerun this AUR path.
  **Found the actual fix:** `extra/hyprpm 0.56.2-3` is a plain official repo package, exact version
  match with the installed `hyprland 0.56.2-3`. No AUR, no rebuild, no conflict risk. Told Vien to
  run `sudo pacman -S hyprpm` instead. Waiting on that now.
- **08:5x** — `sudo pacman -S hyprpm` downloaded `hyprpm` fine but two of its deps 404'd from the
  mirror (`glaze-8.4.0-1`, `hyprland-protocols-0.7.0-1`). Confirmed via direct mirror probing: this
  is normal mirror lag, not a real problem — the mirror has moved on to `glaze-9.0.0-1` and
  `hyprland-protocols-0.7.1-1` and pruned the old files, but the local pacman sync db still pointed
  at the old versions. Fix: `sudo pacman -Syy` (force refresh the db, no upgrades) then retry
  `sudo pacman -S hyprpm`. (The `asahi-alarm` keyring error printed on every pacman call is a
  separate, unrelated repo with a genuinely corrupted PGP signature db — confirmed cosmetic, doesn't
  block `extra`/`core` installs, leaving it alone.) Waiting on Vien to rerun.
- **Later** — `sudo pacman -Syy && sudo pacman -S hyprpm` succeeded. `hyprpm` v0.56.2-3 installed.
- **Later** — `hyprpm add https://github.com/hyprwm/hyprland-plugins` initially failed
  (`Headers outdated, please run hyprpm update.` — needs sudo too, Vien ran `hyprpm update` then
  `add` succeeded).
- **Important discovery:** `hyprpm list` after the add shows only 4 plugins built:
  `borders-plus-plus`, `csgo-vulkan-fix`, `hyprbars`, `hyprfocus`. **`hyprwinwrap` is gone.**
  Verified independently via the live GitHub README
  (`raw.githubusercontent.com/hyprwm/hyprland-plugins/main/README.md`) and the local hyprpm build
  cache (`/var/cache/hyprpm/vien/hyprland-plugins/state.toml`, repo hash
  `7644cecdb947060682891a0db2a0cdc5c0b9e704`) — both confirm hyprwinwrap is no longer part of the
  official `hyprwm/hyprland-plugins` repo. This retroactively makes sense: it's the exact kind of
  plugin (pokes Hyprland's internal Config structs directly, hooks the config-reload signal) that
  tends to get dropped by upstream once it becomes an ABI-maintenance burden — plausibly *why* it
  was pulled, and consistent with the segfault we saw.
  - Found a community-maintained standalone continuation: `github.com/gen3vra/hyprwinwrap`
    (not affiliated with hyprwm as far as the README shows). Requires Hyprland 0.54+ (we're on
    0.56.2, fine). Install: `hyprpm add https://github.com/gen3vra/hyprwinwrap` then
    `hyprpm enable hyprwinwrap`. Config now uses a newer Lua-based config
    (`hl.plugin.hyprwinwrap.window()` with class/pos/size), not the old Hyprlang
    `plugin:hyprwinwrap:*` block in our `wallpaper.conf` — that file will need rewriting either way,
    not just a swap. No open GitHub issues at last check, but that's weak evidence of stability
    on its own — it's a different, unverified codebase from what actually crashed.
  - **This is a decision point, not just a mechanical fix** — asked Vien how he wants to proceed
    (stick with the community fork, or drop the live-window-wallpaper approach for something
    simpler/more stable like `mpvpaper`/`hyprpaper` rotating stills).
- **Vien chose: try the community fork.** Before installing it, checked whether it needs Hyprland's
  new Lua config (`hyprland.lua`) — it does have a Lua mode, but **also a legacy Hyprlang mode**
  (`plugin { hyprwinwrap { class = ... } }`, same field names as before: class/title/pos_x/pos_y/
  size_x/size_y) that needs no Lua at all. Good, because Hyprland's Lua and legacy `.conf` configs
  are mutually exclusive (whichever exists at startup wins) — switching to Lua would have meant
  converting this whole Omarchy config, way out of scope. Using the legacy mode.
- **Later** — `hyprpm add https://github.com/gen3vra/hyprwinwrap`: built fine (compiled clean
  against our headers), but failed at the final "Installing repository" step
  (`failed to create cache dir`, needs sudo to write `/var/cache/hyprpm/`). Vien reran it himself,
  answered the "do you trust this plugin" prompt, succeeded. `hyprpm list` now shows
  `hyprwinwrap (by gen3vra)`, not yet enabled.
- **Later** — Rewrote `~/.config/hypr/wallpaper.conf`: removed the old manual
  `plugin = /home/vien/.local/share/hyprwinwrap/libhyprwinwrap.so` line (that file is now dead,
  left in place but unreferenced — hyprpm manages the plugin path itself, under
  `/var/cache/hyprpm/vien/hyprwinwrap/hyprwinwrap.so`). Kept the same
  `plugin:hyprwinwrap:class/size_x/size_y/pos_x/pos_y` keys since gen3vra's plugin uses identical
  field names. Added `exec-once = hyprpm reload -n` to `~/.config/hypr/autostart.conf`, right before
  the wallpaper Chrome launch line, so the plugin loads on every future Hyprland start (this is the
  standard hyprpm pattern — plugin load state doesn't otherwise persist across restarts).
  Saving these files did NOT trigger a crash or any config errors (`hyprctl configerrors` clean,
  no new crash report) — expected, since no plugin was loaded yet to have anything crash in.
- **Later** — `hyprpm enable hyprwinwrap` (from my side, non-interactive) failed:
  `Failed to write plugin state` — another sudo-gated write. Asked Vien to run it himself.
  **This is the actual moment of truth**: it loads the new plugin into the *live* running Hyprland
  session, which is functionally close to what crashed originally. If Hyprland crashes here, refer
  back to this file — we're mid-way through switching from the abandoned official hyprwinwrap to
  the gen3vra community fork; the rollback section below still applies unchanged.
- **Later** — Vien ran it, no crash, but `hyprpm list` showed `enabled: true` while
  `hyprctl plugins list` still said "no plugins loaded" (known hyprpm quirk — `enable` can update
  state without actually hot-loading into the live session). Loaded it directly myself instead:
  `hyprctl plugin load /var/cache/hyprpm/vien/hyprwinwrap/hyprwinwrap.so` →
  **`could not be loaded: plugin crashed/threw in main: hyprwinwrap: hooks failed`**. No crash
  report generated, Hyprland stayed completely stable — the plugin threw a caught C++ exception
  instead of segfaulting. Better behavior than the old plugin, but still not working.

## ROOT CAUSE, FOR REAL: aarch64 (this is an Asahi Linux / Apple Silicon machine)

`os-release` on this machine is `Arch Linux ARM` and `pacman.conf` has an `asahi-alarm` repo — this
laptop is aarch64 (Apple Silicon under Asahi Linux), not x86_64.

Traced `gen3vra/hyprwinwrap`'s `main.cpp` (cloned to `/tmp/.../scratchpad/hyprwinwrap/main.cpp`
around line 560): it finds two private Hyprland symbols by mangled name
(`Desktop::View::CSubsurface::onCommit()`, `Desktop::View::CWindow::commitWindow()`) — both were
found fine — then calls `HyprlandAPI::createFunctionHook(...)->hook()` on each, an **inline
function-patching hook**. Both `hook()` calls returned `false`, so the plugin correctly threw
`"hyprwinwrap: hooks failed"` and bailed out cleanly.

Confirmed via web search this is architectural, not a bug: Hyprland's `createFunctionHook` /
inline-hooking mechanism **only works on x86_64**. On any other architecture (including aarch64),
Hyprland silently no-ops the hook installation. Source: Hyprland maintainer discussion, quoted
verbatim — *"Function hooks are only available on AMD64 (x86_64). Attempting to hook on any other
arch will make Hyprland simply ignore your hooking attempt."*

**This means no version of hyprwinwrap — official (now removed upstream) or the gen3vra community
fork — can ever work on this machine.** It's not a plugin bug, a build issue, or something fixable
by picking a different fork: "pin an arbitrary window as the live wallpaper via a Hyprland plugin"
is fundamentally unsupported on aarch64/Apple Silicon in current Hyprland. This also retroactively
explains the *original* crash better than the ABI-mismatch theory: the old plugin almost certainly
hit this same "hooks silently don't work on ARM" condition, just handled it far worse (a SIGSEGV
instead of a caught exception) when it then tried to use hooks that were never actually installed.

**Step 6 of docs/omarchy.md (live animated wallpaper via hyprwinwrap) needs to be marked as not
viable on this hardware.** Given this, presented Vien the real remaining options: drop it
entirely, or replace "pin the live Chrome window" with something that doesn't need function
hooking at all — e.g. `mpvpaper` playing a pre-rendered video loop of the scenery (no window
hooking, just a wallpaper daemon playing media — architecture-agnostic), or `hyprpaper`
cycling static PNGs per prayer time (the step 2.5 idea already in the docs, zero animation but
zero risk too).

**Vien chose: mpvpaper video loop.** New direction, not a bug fix anymore — see the "mpvpaper
plan" section below once it exists.

## Cleanup back to a stable baseline (done, before starting mpvpaper work)

- `hyprpm disable hyprwinwrap` (Vien ran it, needed sudo).
- Rewrote `~/.config/hypr/wallpaper.conf` to a short stub explaining why hyprwinwrap is abandoned
  here (kept the file so `hyprland.conf`'s `source =` line doesn't need touching).
- Removed the two dead `exec-once` lines from `~/.config/hypr/autostart.conf` (`hyprpm reload -n`
  and the `--class=rpi-wallpaper` Chrome launch).
- Deleted `~/.local/share/hyprwinwrap/` (the old manually-built, now-unreferenced `.so`).
- Verified clean: `hyprctl configerrors` empty, `hyprctl plugins list` → "no plugins loaded",
  `hyprpm list` → hyprwinwrap `enabled: false`, no new crash report since the original 04:23 one.
  Hyprland session has been stable and untouched by any of this since ~04:41 this session.

## mpvpaper build (in progress)

Plan approved (`/home/vien/.claude/plans/cozy-kindling-sunset.md`), confirmed with Vien: render at
1920x1080 (moderate quality/battery tradeoff vs native 3456x2160/2560x1440).

Built:
- `omarchy/render-wallpaper-videos.mjs` — headless Chrome (puppeteer-core, added as a root
  devDependency) over each prayer's `?scene=<name>` (scenery mode, art only), screenshot loop at
  20fps piped into ffmpeg → h264 MP4 per prayer under `omarchy/wallpaper-videos/` (gitignored).
  `npm run render-wallpaper-videos` runs it.
  - First attempt used `waitUntil: 'networkidle0'` and timed out — the app holds an open SSE
    connection for live reload that never goes idle, so network never reaches 0. Same class of
    issue CLAUDE.md already warns about for screenshot testing. Fixed: `waitUntil: 'load'` plus a
    fixed 3s settle delay instead.
  - Smoke-tested at 5s/scene first (all 5 scenes, fast) before committing to the real 60s/scene
    render. Confirmed output is real 1920x1080/h264/20fps via `ffprobe`, and visually confirmed by
    extracting a frame — clean Al-Aqsa Fajr scene, no exit-scenery button, no widget chrome baked
    in. Pipeline validated before spending the ~5 minutes on the full render.
- `omarchy/wallpaper-swap.mjs` — idempotent runtime script: reads `/api/prayer/today`,
  reimplements `prayerClock.ts`'s `currentPeriod()` standalone (that file reads `location` at
  module scope, not importable from plain Node), kills `swaybg` (Omarchy's default background,
  same layer-shell layer mpvpaper needs), and either launches `mpvpaper` or hot-swaps the file over
  its mpv IPC socket (`/tmp/mpvpaper-wallpaper.sock`) if already running — no flash on prayer
  transitions. State tracked in `~/.cache/rpi-dashboard/wallpaper-period`.
- `omarchy/wallpaper-swap.service` + `.timer` (`OnCalendar=*:*:00`), same style as the existing
  `omarchy/rpi-dashboard.service`. Not yet installed/enabled (that's a `systemctl --user` step,
  still to do).
- `~/.config/hypr/autostart.conf` — added `exec-once` for `wallpaper-swap.mjs` at login.
- `~/.config/hypr/wallpaper.conf` — rewritten as a doc-only stub (mpvpaper needs no Hyprland
  config directives, just the autostart line).
- `docs/omarchy.md` step 6 rewritten to describe mpvpaper and explain why hyprwinwrap is a dead
  end here, plus the rollback table entry updated.

## Verified working (2026-09-29, ~06:09 EDT)

- **Render pipeline**: hit two real bugs before it worked right, both fixed:
  1. `waitUntil: 'networkidle0'` hung forever — the app holds an open SSE connection for live
     reload that never goes idle. Fixed: `waitUntil: 'load'` + fixed 3s settle delay.
  2. Initial version forced `--use-angle=swiftshader` (software rendering) per the
     screenshot-testing gotcha in `CLAUDE.md` — but that guidance was written for headless capture
     reliability on other platforms, not for throughput on this machine. It ran at ~325% CPU, on
     pace to take *hours* for 5 scenes. This machine actually has working GPU acceleration (the
     live dashboard window proves it) — switched to `headless: false` +
     `--ozone-platform=wayland` (a real, briefly-visible Wayland window instead of forced
     software rendering) and it dropped to a few minutes per scene.
  - Full 5-scene, 60s-each render completed in ~44 minutes wall time (slower and more variable
    than hoped — pace fluctuated between ~150ms/frame and >1s/frame with no clear cause; system
    resources stayed idle throughout (load ~0.5, 30°C, plenty of free RAM), so it's some kind of
    IPC/scheduling jitter in the capture loop, not resource exhaustion. Not worth chasing further
    since it's a one-off/occasional script, not something that runs continuously.
  - Verified via `ffprobe`: all 5 files are 1920x1080, h264, 20fps, exactly 60.000000s. Visually
    confirmed one frame (Fajr/Al-Aqsa) — clean capture, no exit-scenery button, no widget chrome.
- **Live verification**: ran `wallpaper-swap.mjs` by hand. Confirmed via `hyprctl layers`:
  mpvpaper on the `background` layer (namespace `mpvpaper`), swaybg gone. Screenshotted an empty
  workspace with `grim` — the correct scene (Farooq-Isha courtyard) is genuinely playing as the
  desktop background, matching Waybar's "Isha · 16m left" indicator, upscaled cleanly to the
  panel's native 3456x2160 from the 1080p source.
- **Cost**: mpvpaper holds steady ~25% CPU (on a 10-core machine, so roughly a quarter of one
  core — light). `vaInitialize failed: unknown libva error` confirms hardware video decode isn't
  available on this Asahi setup, so that 25% is software decode; still a very reasonable ambient
  cost, dramatically cheaper than the live Chrome canvas hyprwinwrap would have kept running.
- **systemd timer**: installed and enabled (`wallpaper-swap.timer`/`.service` symlinked into
  `~/.config/systemd/user/`, same pattern as `rpi-dashboard.service`). First live tick completed
  `status=0/SUCCESS`, mpvpaper's PID was unchanged afterward (idempotent no-op confirmed — no
  restart/flash when the period hasn't changed), next tick correctly scheduled a minute out.

**Not yet tested**: an actual period-change swap (the IPC `loadfile ... replace` path) and a cold
Hyprland login (autostart line). Both are low-risk relative to everything already proven — the IPC
swap is a well-defined mpv feature, and the autostart line is a single `exec-once`, same style as
the ones already running successfully all session. Confirm opportunistically next time the prayer
period actually changes, or by editing the state file to force it.

## Follow-ups noted, not started

- **Interactive corner widget** (Quran verse / Salah, always visible, auto-hidden by real windows
  the way wallpaper is): needs a genuine Wayland layer-shell client (eww/ags), not a browser
  window — Hyprland's floating-window stacking has no robust "always below normal windows" rule,
  and the trick that would force it (window hooking) is the same thing that doesn't work here.
- **ARM64 Hyprland function-hooking**: investigated as "why can't we just fix hyprwinwrap
  properly," concluded it's a real, legitimate gap (not fixed on principle, just never built for
  aarch64) but a multi-day, high-risk undertaking that must never touch the live session — full
  writeup and safety requirements at `~/Projects/hyprland-arm64-hooks/NOTES.md`.
- **Hook-free live wallpaper** (better than the current pre-rendered loop, without touching
  Hyprland internals): Wayland's screen-capture protocols (`wlr-screencopy`,
  `ext-image-copy-capture`) could let a small client continuously mirror the *live* dashboard's
  `?wallpaper` window into a background-layer display, architecture-agnostic by construction.
  Worth trying before ever attempting the hook-porting project above — noted for
  `~/Projects/hyprland-arm64-hooks/NOTES.md` as the preferred thing to try first.

## Prayer-start banner animation (added same session)

Vien wanted the app's "prayer just started" `PixelTitle` fly-in animation to also play on the
wallpaper, once, exactly when a real prayer-time transition happens (not baked decoratively into
the loop - the more accurate but more complex option, chosen deliberately over the simpler
always-repeats-every-60s alternative).

**Two real bugs found and fixed along the way:**

1. **`config/dashboard.json` had `pages[0].sceneOverride: "sophia-asr"` baked in** - the home
   page's background was pinned to a fixed Asr/Hagia Sophia scene regardless of real prayer time,
   which affected not just the banner capture but the **actual live dashboard app** too (pre-existing,
   not something this session caused). Traced via `App.svelte`'s `sceneFor()`: a page's
   `sceneOverride` unconditionally wins over the real/forced prayer period unless `view.selected`
   is set by an actual tap - so `?prayer=fajr` correctly forced the banner *text* (`period.prayer`,
   a separate code path) but not the *background scene* behind it. A same-machine workaround
   (simulate a tap on the correct Salah row before capturing) was considered but rejected - it has
   a real edge case where tapping the row for whichever prayer is *currently live* toggles
   selection **off** instead of on (`togglePrayer`'s intentional behavior), landing back on the
   override. Confirmed with Vien and cleared `sceneOverride` entirely - fixes it for all 5 banners
   *and* restores the intended "home follows prayer times" behavior on the real live app.
2. **mpv IPC `loadfile`'s 4th "options" argument isn't accepted by this mpv version** -
   `["loadfile", path, "replace", "loop-file=no,keep-open=yes"]` returned
   `{"error":"invalid parameter"}` (confirmed by testing the exact command by hand via `socat`
   before touching the script - the 3-arg form works fine). Fixed by using explicit
   `set_property loop-file no/inf` calls around each `loadfile` instead, which works cleanly.

**Built:**
- `renderBanner()` added to `render-wallpaper-videos.mjs`: navigates to `?prayer=<name>&banner`
  (forces the PixelTitle "TIME FOR <PRAYER>" fly-in via `forceBanner`), hides `.area.top-left`
  (clock) and `.area.top-right` (Salah) via injected CSS, and within `.area.top-center` hides the
  Verse `figure` but keeps the banner canvas - leaving just the scene + banner. Captures 5.5s
  (fly-in completes ~3.4s per `PixelTitle.svelte`, plus a little settled shimmer) to
  `<prayer>-banner.mp4`. Added `WALLPAPER_SKIP_SCENES=1`/`WALLPAPER_SKIP_BANNERS=1` env flags so
  either half can be re-rendered independently without redoing the other (the banner bugs needed
  two re-renders; no need to redo the 44-minute scene loops each time).
- `wallpaper-swap.mjs`: on a genuine period change while mpvpaper is already running, now plays
  `<period>-banner.mp4` once (`loop-file=no`) for `BANNER_DURATION_MS` (5800ms, matching the
  5.5s clip plus slack), then switches to the looping `<period>.mp4` (`loop-file=inf`). Added
  `keep-open=yes` to mpvpaper's global spawn options so it holds the last frame instead of
  flashing black in the gap between the clip ending and the switch, if timing is ever slightly off.
  Cold start (mpvpaper not running yet) skips the banner and goes straight to the loop - the
  banner is specifically for live transitions the running timer catches, not session startup.

**Verified end-to-end**: manually cleared the state file to simulate a transition, polled mpv's
`path` property every second via IPC through the whole sequence - confirmed `fajr-banner.mp4` for
the first ~5s, then `fajr.mp4` after - and screenshotted mid-sequence on an empty workspace,
catching the pixel-dust particles actually mid-flight, assembling into the title, live on the
actual desktop.

## Wallpaper froze (found and fixed same session)

Vien reported the wallpaper frozen. Cause: `mpvpaper` was launched with `--auto-pause --auto-mode
FULL` (pauses when the wallpaper layer is covered/hidden - a sensible-sounding battery optimization
at the time). Its resume detection isn't reliable: confirmed live via IPC (`get_property pause` →
`true`, `time-pos` stuck at the same value across repeated checks) that it stayed paused even
immediately after a fresh `loadfile`, while the wallpaper was genuinely covered by terminal windows
- and nothing reliably un-paused it once covered. A manual `set_property pause no` worked
temporarily but got silently re-paused shortly after by the same auto-pause logic.

Fix: removed `--auto-pause`/`--auto-mode FULL` from mpvpaper's launch args entirely. Always-on
costs the same ~25% CPU already measured and judged acceptable earlier in this doc (a quarter of
one core on this 10-core machine) - reliability (never silently frozen) won over the modest,
already-accepted battery cost of a feature that didn't reliably do what it promised anyway.
Restarted mpvpaper with the new args (fresh PID), confirmed via IPC `time-pos` advancing steadily
across repeated checks (not stuck), `hyprctl configerrors` clean, no new crash report, background
layer intact.

**Froze again anyway - `--auto-pause` was a red herring, the real bug was in the banner→loop
transition itself.** Triggering the banner sequence manually to demo it for Vien reproduced the
exact same frozen symptom with `--auto-pause` already confirmed removed (checked the live
`mpvpaper` process's actual command line to be sure). Root cause: `keep-open=yes` (set globally,
originally added so the *banner* clip holds its last frame instead of flashing black in the gap
before the switch) pauses mpv whenever ANY file hits its natural end - including the banner clip
itself hitting its own 5.5s end right before `wallpaper-swap.mjs` switches to the loop. That pause
state is sticky across the following `loadfile` call instead of resetting, so the newly-loaded
looping video inherits `pause=yes` and sits stuck on frame 0 indefinitely.

Fix: added an explicit `set_property pause no` immediately after the final `loadfile` that loads
the looping scene. Verified via IPC: `pause` → `false`, `time-pos` advancing correctly (2.05s →
4.05s over 2 real seconds) after a full simulated transition.

## Manual scene preview (added same session)

Vien wanted a quick way to preview a different scene on demand. Built
`omarchy/wallpaper-preview-next.mjs`: cycles fajr→dhuhr→asr→maghrib→isha→fajr... over mpv's IPC
socket, sends a confirming notification, and tracks its own index file
(`~/.cache/rpi-dashboard/wallpaper-preview-index`) — deliberately separate from
`wallpaper-swap.mjs`'s state file, so a preview is naturally temporary: it reverts on its own at
the next real prayer-time change, no extra logic needed.

Wanted it reachable via the same gesture as the Omarchy menu (`SUPER ALT, SPACE`) — but that menu
is Omarchy's own script (`~/.local/share/omarchy/bin/omarchy-menu`), off-limits to edit (owned by
Omarchy, overwritten on update). Used `SUPER, U` instead — it was already sitting there labeled
"Interact with wallpaper," dead code left over from the old hyprwinwrap plugin
(`hyprctl dispatch hyprwinwrap_interactivity`, a no-op now). Repurposed it, which also cleaned up
that stale reference.

Verified: pressed it 3 times, index advanced 0→1→2 correctly, notification fired each time
("Fajr · Al-Aqsa" etc.), and a screenshot on an empty workspace confirmed the actual background
matched (3rd press → Hagia Sophia/Asr scene) while Waybar's real prayer indicator stayed
untouched ("Fajr · 2h 2m left" — the real clock, unaffected by the preview).

## Black bars top/bottom (found and fixed same session)

Vien reported black letterbox bars top and bottom of the wallpaper. Cause: videos are 1920x1080
(16:9), but `eDP-1` (the laptop panel) is 3456x2160 (16:10) — mpv's default fit-without-crop
scaling shrinks the video to fit the width, leaving black bars to fill the extra height. `HDMI-A-1`
is exactly 2560x1440 (16:9), unaffected.

Fix: added `panscan=1.0` to mpvpaper's `-o` mpv-options string in `wallpaper-swap.mjs` (crop-to-fill
instead of fit-with-bars - the normal choice for wallpapers, a little off the sides is preferable to
black bars). Tested live first via the IPC socket (`set_property panscan 1.0`) before making it
permanent, confirmed via screenshot - scene now fills the screen edge to edge, no bars.

## Banner redesign: always visible + replays on workspace switch

Vien changed his mind on the banner design after seeing it once-per-transition: wants it
**permanently visible for the whole prayer period** (like the app's own `showCurrent` setting),
and wants it to **replay every time he switches Hyprland workspaces** (`SUPER+1/2/3`), accepting
the tradeoff of a visible restart each time.

This simplified the architecture rather than complicating it further - collapsed back to one video
per prayer instead of two:

- `render-wallpaper-videos.mjs`: the *only* capture per prayer is now `?prayer=<name>&banner` (the
  home page, widgets hidden via CSS) for the *full* 60s duration - no more separate short banner
  clip. `PixelTitle` keeps animating indefinitely once mounted (gold sweep + sparkles, not just the
  ~3.4s fly-in), so it's visible for the whole video, satisfying "always visible" directly.
- `wallpaper-swap.mjs`: back to a single `loadfile` per transition, no more banner-then-loop
  handoff. This *structurally* removes the whole `keep-open`/sticky-pause bug class from two
  entries up - there's no longer a short non-looping clip to hit an EOF-triggered pause on.
- New `omarchy/wallpaper-workspace-listener.mjs`: a long-running process (not a timer - started
  once from `autostart.conf`) that connects to Hyprland's own event socket
  (`$XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/.socket2.sock`) and sends mpv's IPC
  `seek 0 absolute` on every `workspace>>` event, restarting the video (and therefore replaying
  the fly-in) on every workspace switch. Verified the event format by hand first
  (`socat -u UNIX-CONNECT:... -` while switching workspaces) before writing the listener against
  it, and verified the listener itself works (`time-pos` jumped from 56.1s back to 0.45s
  immediately after a workspace switch) before wiring it into autostart.

Deleted the now-unused `<prayer>-banner.mp4` files.

**Verified working end-to-end after the full 5-scene re-render (~15 min this time, faster than
the first 44-min run - no more per-scene banner clip on top of the main capture):**
- `ffprobe` on all 5: 1920x1080, h264, 20fps, 60.000000s.
- Extracted a frame at t=30s (fajr.mp4, well past the ~3.4s fly-in) - banner still visible,
  confirming "always visible for the whole clip" actually holds, not just at the start.
- Loaded live via `wallpaper-swap.mjs`, confirmed not paused, correct file.
- Advanced playback (`time-pos` 13.05s), switched workspace, confirmed `time-pos` reset to 0.45s
  immediately after - the listener works against the new videos too.
- Screenshotted mid-switch on an empty workspace - caught the fly-in actually mid-assembly, live,
  confirming the retrigger is visually real, not just correct in IPC state.
- `hyprctl configerrors` clean, no new crash report, `mpvpaper` and
  `wallpaper-workspace-listener.mjs` both still running throughout.

## Scenery scenes made pinnable too (2026-10-07)

Vien wanted the six non-prayer scenery scenes (`aqsa-sunset`, `farooq-wedding`, `haram-aerial`,
`kazakh-meadow`, `madinah`, `night-mosque` — see CLAUDE.md's scene table) available as live
wallpaper picks too, not just the five prayer scenes, specifically calling out the Kaaba aerial
view (`haram-aerial`).

- New `omarchy/render-scenery-videos.mjs`: same capture pipeline as
  `render-wallpaper-videos.mjs --clean` (headless Chrome, puppeteer-core, `--ozone-platform=wayland`
  so it composites on GPU instead of falling back to ~325% CPU swiftshader), but hits scenery mode
  (`?scene=<name>`) instead of `?prayer=<name>`, and hides just the `.exit-scenery` ✕ button via
  injected CSS (scenery mode already hides every widget on its own). Writes straight into the
  existing `wallpaper-videos-clean/` dir, named by scene (e.g. `haram-aerial.mp4`), since
  `wallpaper-swap.mjs` already reads from there by filename regardless of whether the name is a
  prayer or a scene.
- `wallpaper-swap.mjs`: added a `SCENERY_SCENES` list and a combined `PINNABLE` (= prayers +
  scenery) that `--pin` now validates against, instead of only the five prayers. `updateGlow()`
  now no-ops when `GLOW_COLORS[period]` is undefined (true for every scenery scene — there's no
  "time of day" glow for e.g. an aerial mataf shot), leaving the shadow color as whatever it last
  was rather than writing `rgb(undefined)` into `wallpaper-glow.conf`.
- `~/.config/omarchy/extensions/menu.sh`: added all six scenery scenes to
  `show_background_menu()`, each just running `wallpaper-swap.mjs --pin <name>` like the prayers
  do.

**Verified live:** rendered all six (~35 min total, no CPU fallback — confirmed
`vaapi_wrapper.cc` GPU init messages in the Chrome log, not the swiftshader software path);
`ffprobe`'d clean on all six 1920x1080/h264/20fps files. Ran
`wallpaper-swap.mjs --pin haram-aerial`, then queried mpv's IPC socket directly
(`get_property path`) rather than trusting the script's own "Swapped wallpaper to…" log line or
`pgrep`'s (stale, launch-time-only) command line — confirmed mpv was actually playing
`wallpaper-videos-clean/haram-aerial.mp4`. Then `--auto` to release the pin back to real time,
confirmed it swapped to the actual current prayer (`asr`, matching the real clock at the time).
