/** Page navigation, decoupled from the UI: widgets fire an event, App listens. */
export type Direction = 'next' | 'prev'

export const navigate = (dir: Direction) => window.dispatchEvent(new CustomEvent<Direction>('dashboard:navigate', { detail: dir }))

export function onNavigate(handler: (dir: Direction) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<Direction>).detail)
  window.addEventListener('dashboard:navigate', listener)
  return () => window.removeEventListener('dashboard:navigate', listener)
}
