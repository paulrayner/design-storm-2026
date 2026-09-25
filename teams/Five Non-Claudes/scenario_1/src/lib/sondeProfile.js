// Reading the Strontia sonde's depth profile (precompute.py → sonde_profile).
// Bands are contiguous, top to bottom, in metres; turbidity is [p25, median, p75].

const M_PER_FT = 0.3048

// Intake gates at Strontia Springs, from Cassidi's whiteboard sketch: a top intake
// and gates at 15, 45, 65 and 95 ft, with 45 ft the one they prefer to pull from.
// We assume depths are from the actual water surface, as the sonde's are; if they
// are from full pool, each gate sits shallower by however far the reservoir is down.
export const GATES = [
  { id: 'top', label: 'Top', ft: 0 },
  { id: '15', label: '15 ft', ft: 15 },
  { id: '45', label: '45 ft', ft: 45, primary: true },
  { id: '65', label: '65 ft', ft: 65 },
  { id: '95', label: '95 ft', ft: 95 },
]
export const PRIMARY_GATE = GATES.find((g) => g.primary)

const median = (b) => b.turbidity[1]

// A band this close to the clearest one counts as just as clear: the difference is
// smaller than the spread between casts.
const CLEAR_SLACK = 1.2
// A layer is called murky when it is at least twice as turbid as the clearest.
const MURKY_RATIO = 2

/** The band holding `depth`, clamped to the profile's ends. */
export function bandAt(bands, depth) {
  return bands.find((b) => depth < b.bottom) ?? bands[bands.length - 1]
}

// Grow from band i outward while neighbours pass `keep`.
function spread(bands, i, keep) {
  let lo = i
  let hi = i
  while (lo > 0 && keep(bands[lo - 1])) lo--
  while (hi < bands.length - 1 && keep(bands[hi + 1])) hi++
  return { top: bands[lo].top, bottom: bands[hi].bottom }
}

/**
 * The clearest stretch of water column: the lowest-median band plus any adjoining
 * bands within CLEAR_SLACK of it.
 * @returns {{ top:number, bottom:number, turbidity:number }}
 */
export function clearestLayer(bands) {
  const i = bands.reduce((best, b, j) => (median(b) < median(bands[best]) ? j : best), 0)
  const min = median(bands[i])
  return { ...spread(bands, i, (b) => median(b) <= min * CLEAR_SLACK), turbidity: min }
}

/**
 * The murkiest stretch, if any band is at least MURKY_RATIO times the clearest;
 * otherwise null (the column is fairly even and there is nothing to avoid).
 * @returns {{ top:number, bottom:number, peak:number } | null}
 */
export function murkyLayer(bands) {
  const min = clearestLayer(bands).turbidity
  const i = bands.reduce((best, b, j) => (median(b) > median(bands[best]) ? j : best), 0)
  const peak = median(bands[i])
  if (peak < min * MURKY_RATIO) return null
  return { ...spread(bands, i, (b) => median(b) >= min * MURKY_RATIO), peak }
}

/** The profile band a gate draws from. */
export function gateBand(bands, gate) {
  return bandAt(bands, gate.ft * M_PER_FT)
}

/** The gate whose depth had the lowest typical turbidity. */
export function clearestGate(bands, gates = GATES) {
  return gates.reduce((best, g) => (median(gateBand(bands, g)) < median(gateBand(bands, best)) ? g : best))
}

/**
 * How the primary gate's water compared this week. `murky` is true when the gate
 * sits inside the murky layer, the case worth a second look.
 */
export function primaryGateCheck(bands) {
  const band = gateBand(bands, PRIMARY_GATE)
  const layer = murkyLayer(bands)
  const murky = !!layer && band.top >= layer.top && band.bottom <= layer.bottom
  const clearest = clearestGate(bands)
  return {
    gate: PRIMARY_GATE,
    turbidity: median(band),
    murky,
    clearest,
    clearestTurbidity: median(gateBand(bands, clearest)),
  }
}

// The sonde is not a live feed. Past this many days, its week of casts says what the
// reservoir was like, not what it is like today.
export const STALE_DAYS = 2

/** Whole days from the profile's last cast to `now`'s local calendar day. */
export function profileAgeDays(profile, now = new Date()) {
  const last = Date.parse(profile.to + 'T00:00:00Z')
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((today - last) / 86400000)
}
