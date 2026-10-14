/** requestAnimationFrame loop capped at `fps`. Calls `frame(seconds)`. Returns a stop function. */
export function startLoop(fps: number, frame: (t: number) => void): () => void {
  const interval = 1000 / fps
  let last = 0
  let handle = 0
  const start = performance.now()

  const tick = (now: number) => {
    handle = requestAnimationFrame(tick)
    if (now - last < interval - 1) return
    last = now
    frame(Math.max(0, now - start) / 1000) // rAF timestamps can precede `start`
  }
  handle = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(handle)
}
