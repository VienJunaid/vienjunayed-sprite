import type { BackgroundAsset } from '../../lib/types'
import type { Background, SceneContext } from '../types'
import { farooq } from './farooq'
import { farooqNight } from './farooqNight'
import { frames } from './frames'
import { haram } from './haram'
import { kaaba } from './kaaba'
import { madinah } from './madinah'
import { meadow } from './meadow'
import { sophia } from './sophia'
import { sunset } from './sunset'
import { water } from './water'

/** Procedural effects by name. Add new ones here (e.g. rain, sand, aurora). */
const EFFECTS: Record<string, (ctx: SceneContext, params: any) => Background> = {
  water,
  sunset,
  haram,
  kaaba,
  sophia,
  madinah,
  farooq,
  farooqNight,
  meadow,
  none: () => ({ draw() {} }),
}

export function createBackground(ctx: SceneContext, asset: BackgroundAsset | undefined): Background {
  if (!asset) return EFFECTS.none(ctx, {})
  if (asset.type === 'frames') return frames(ctx, asset)
  const effect = EFFECTS[asset.effect]
  if (!effect) {
    console.warn(`Unknown background effect "${asset.effect}"`)
    return EFFECTS.none(ctx, {})
  }
  return effect(ctx, asset.params ?? {})
}
