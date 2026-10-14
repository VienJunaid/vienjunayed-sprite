# MacBookPro theme

Omarchy theme for Vien's laptop. Colors from `config/themes/haram-night.json`.

- `backgrounds/1-whitemasjid.jpg` — static fallback wallpaper (used by `omarchy theme set` /
  `omarchy-theme-bg-next`, and whenever the live wallpaper service below is stopped).
- The actual per-prayer **live video** wallpaper is a separate piece, not part of Omarchy's theme
  system (Omarchy's background system is images only): see `omarchy/wallpaper-videos/` and
  `omarchy/wallpaper-swap.mjs`, run by the `wallpaper-swap.timer` user service (step 6 of
  `docs/omarchy.md`). It swaps `mpvpaper`'s video every minute based on the current prayer period,
  and kills `swaybg` so the video isn't covered.

Install:

```bash
ln -sf "$PWD/omarchy/themes/MacBookPro" ~/.config/omarchy/themes/MacBookPro
omarchy theme set MacBookPro
```
