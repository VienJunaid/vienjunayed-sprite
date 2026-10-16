import type { BackgroundAsset, CharacterAsset } from '../../lib/types'
import type { Background, SceneContext } from '../types'
import { farooq } from './farooq'
import { farooqNight } from './farooqNight'
import { frames } from './frames'
import { haram } from './haram'
import { journey } from './journey'
import { kaaba } from './kaaba'
import { madinah } from './madinah'
import { meadow } from './meadow'
import { sophia } from './sophia'
import { sunset } from './sunset'
import { water } from './water'

/** Procedural effects by name. Add new ones here (e.g. rain, sand, aurora). */
const EFFECTS: Record<string, (ctx: SceneContext, params: any, characters?: Map<string, CharacterAsset>) => Background> = {
  water,
  sunset,
  haram,
  kaaba,
  sophia,
  madinah,
  farooq,
  farooqNight,
  meadow,
  journey,
  none: () => ({ draw() {} }),
}

/** `characters` are the scene's loaded character assets, for effects that draw them themselves (journey). */
export function createBackground(ctx: SceneContext, asset: BackgroundAsset | undefined, characters?: Map<string, CharacterAsset>): Background {
  if (!asset) return EFFECTS.none(ctx, {})
  if (asset.type === 'frames') return frames(ctx, asset)
  const effect = EFFECTS[asset.effect]
  if (!effect) {
    console.warn(`Unknown background effect "${asset.effect}"`)
    return EFFECTS.none(ctx, {})
  }
  return effect(ctx, asset.params ?? {}, characters)
}
