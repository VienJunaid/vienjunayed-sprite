/**
 * How the scene renderer is doing, updated by AsciiScene every 30 frames. A plain object (not
 * reactive) so the render loop never triggers Svelte updates; the health page polls it.
 */
export const renderStats = {
  renderer: '',
  /** Graphics chip (WebGL only). A software name here means no GPU: slow and hot. */
  gpu: '',
  cols: 0,
  rows: 0,
  fps: 0,
  /** Scene CPU time per frame, ms (the budget is < 1 ms on a laptop, ~10× that on the Pi). */
  msPerFrame: 0,
  /** True while a plain page is showing and nothing is drawn. */
  paused: false,
}
