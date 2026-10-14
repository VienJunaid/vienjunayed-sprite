import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan'
import { readConfig } from './config.js'

const NAMES = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const
const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const
type MethodName = keyof typeof CalculationMethod

/** Today's and tomorrow's times from adhan, or undefined when no location is set. */
async function calculate(now: Date) {
  const { prayer = {} } = await readConfig()
  const latitude = prayer.latitude ?? Number(process.env.LATITUDE)
  const longitude = prayer.longitude ?? Number(process.env.LONGITUDE)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined

  const methodName = (prayer.method ?? 'NorthAmerica') as MethodName
  const params = (CalculationMethod[methodName] ?? CalculationMethod.NorthAmerica)()
  params.madhab = prayer.madhab === 'Hanafi' ? Madhab.Hanafi : Madhab.Shafi

  const coords = new Coordinates(latitude, longitude)
  return {
    methodName,
    today: new PrayerTimes(coords, now, params),
    tomorrow: new PrayerTimes(coords, new Date(now.getTime() + 86_400_000), params),
  }
}

export async function prayersToday(now = new Date()) {
  const calc = await calculate(now)
  if (!calc) return undefined
  const { today, tomorrow, methodName } = calc

  const times = NAMES.map((name) => ({ name, time: today[name].toISOString() }))
  const nextName = today.nextPrayer()
  const next =
    nextName === 'none'
      ? { name: 'fajr', time: tomorrow.fajr.toISOString() }
      : { name: nextName, time: today.timeForPrayer(nextName)!.toISOString() }

  return {
    times,
    next,
    current: today.currentPrayer(),
    method: methodName,
    timezone: process.env.TIMEZONE || undefined,
  }
}

/** The prayer that started within the last `minutes`, and when that window ends. */
export async function prayerJustStarted(minutes: number, now = new Date()) {
  const calc = await calculate(now)
  if (!calc) return undefined
  for (const prayer of PRAYERS) {
    const since = now.getTime() - calc.today[prayer].getTime()
    if (since >= 0 && since < minutes * 60_000) {
      return { prayer, until: new Date(calc.today[prayer].getTime() + minutes * 60_000) }
    }
  }
  return undefined
}
