import type { Component } from 'svelte'

export interface WidgetManifest {
  id: string
  name: string
  /** Receives `options` from config/dashboard.json → widgets[].options (may ignore it). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: Component<any>
}

/** One line in a SideCard (Hijri and Calendar cards on the Haram page). */
export interface CardItem {
  key: string
  name: string
  when: string
  /** Marker color (defaults to the accent); `quiet` items are muted. */
  color?: string
  quiet?: boolean
}
