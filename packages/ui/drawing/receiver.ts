// The receiver's likeness: lost, from another world, a little broken, a
// small creature of a radio. The old sketch's lines, kept as they were, now
// drawn as light for the dots to see: a hull of grey-blue haze, a rim
// catching the light, a speaker of slats, a cracked shell, a dial for an
// eye, ticked like a tuning dial, whose needle still glows, a feeler, a
// violet cable trailing loose, three uneven legs on little feet, and a bent
// antenna that pulls out in pieces, whose tip is the brightest thing in it,
// warm enough to bleed into the dark around it.

import {
  curve,
  distance,
  fbm,
  fromLine,
  fromOutline,
  hex,
  mix,
  turn,
  type Color,
  type Field,
  type Light,
  type Point,
} from './lib/field.js'

const rim = hex('#a9c4b3')
const hull = hex('#38536c')
const hullLit = hex('#6284a4')
const dark = hex('#0d141b')
const amber = hex('#ffb347')
const violet = hex('#c77dff')
const grey = hex('#6c7f76')

const body = fromOutline(
  curve([38, 80], [[46, 56], [98, 58]], [[162, 54], [171, 94]], [[182, 150], [128, 168]], [[70, 184], [40, 150]], [
    [22, 118],
    [38, 80],
  ]),
)
// the antenna pulls out in pieces, each thinner than the one before
const antenna = [
  { line: fromLine([[118, 62], [131, 27]]), width: 2.4 },
  { line: fromLine([[131, 27], [141, 33]]), width: 1.8 },
  { line: fromLine([[141, 33], [151, 11]]), width: 1.4 },
]
const feeler = fromLine(curve([80, 60], [[72, 42], [54, 47]]))
const legs = [fromLine([[62, 164], [56, 186]]), fromLine([[104, 172], [106, 194]]), fromLine([[146, 160], [152, 172]])]
const feet = [fromLine([[50, 187], [61, 187]]), fromLine([[101, 195], [112, 195]]), fromLine([[148, 173], [158, 173]])]
const cable = fromLine(curve([42, 148], [[26, 172], [46, 178]], [[62, 182], [54, 196]]))
const crack = fromLine([[100, 60], [108, 76], [101, 84], [110, 96]])
const needle = fromLine([[128, 100], [141, 89]])
// the speaker: an oval of slats where the old sketch had holes
const speaker = (p: Point) => Math.hypot((p[0] - 71) / 21, (p[1] - 117) / 29)
const tip: Point = [151, 11]
const dial: Point = [128, 100]
const knob: Point = [145, 138]
const button: Point = [118, 142]

const lit = (color: Color, energy: number): Light => ({ color, energy })

/** The receiver, in a plane 200 across and 200 down, leaning a little as it always has. */
export function receiver(lean = -9): Field {
  return (x, y) => {
    const p = turn([x, y], [104, 112], -lean)
    if (distance(p, tip) < 7) return lit(amber, 1)
    if (needle(p) < 2.6) return lit(amber, 1)
    if (distance(p, knob) < 2.8) return lit(violet, 1)

    const fromDial = distance(p, dial) - 19
    if (Math.abs(fromDial) < 1.9) return lit(rim, 0.9)
    // the dial's face is lit from behind, faintly, the old way
    if (fromDial < 0) return lit(amber, 0.1 + 0.08 * (1 + fromDial / 19))
    const fromKnob = distance(p, knob) - 8
    if (Math.abs(fromKnob) < 1.5) return lit(rim, 0.8)
    if (fromKnob < 0) return lit(dark, 0.05)
    const fromButton = distance(p, button) - 5
    if (Math.abs(fromButton) < 1.3) return lit(grey, 0.65)
    if (fromButton < 0) return lit(dark, 0.05)
    // the dial is ticked, as a tuning dial is, along its upper arc
    const fromCentre = distance(p, dial)
    if (Math.abs(fromCentre - 25) < 2.6) {
      const angle = (Math.atan2(p[1] - dial[1], p[0] - dial[0]) * 180) / Math.PI
      if (angle < -15 && angle > -165 && Math.abs(((angle + 360) % 30) - 15) > 9) return lit(rim, 0.85)
    }
    if (crack(p) < 1.5) return lit(dark, 0.02)

    const inside = body(p)
    if (Math.abs(inside) < 2.3) return lit(rim, 0.9)
    if (inside < 0) {
      const oval = speaker(p)
      if (Math.abs(oval - 1) < 0.07) return lit(grey, 0.55)
      if (oval < 1) {
        const slat = ((((p[1] - 90) / 12) % 1) + 1) % 1
        return slat < 0.5 ? lit(dark, 0.02) : lit(grey, 0.6)
      }
      // the hull is lit from above and the right, unevenly, the way old paint wears
      const wear = fbm(p[0] * 0.05, p[1] * 0.05)
      const light = Math.max(0, Math.min(1, 0.65 - (p[1] - 60) / 160 + (p[0] - 100) / 300 + (wear - 0.5)))
      return lit(mix(hull, hullLit, light), 0.32 + 0.3 * light)
    }

    if (antenna.some(({ line, width }) => line(p) < width)) return lit(rim, 0.85)
    if (distance(p, [54, 47]) < 3.5) return lit(grey, 0.85)
    if (feeler(p) < 2) return lit(rim, 0.8)
    if (legs.some((leg) => leg(p) < 2.2)) return lit(rim, 0.85)
    if (feet.some((foot) => foot(p) < 1.8)) return lit(grey, 0.75)
    if (cable(p) < 1.8) return lit(violet, 0.9)

    // the tip's warmth, spilling out into the dark
    const glow = distance(p, tip)
    if (glow < 20) return lit(amber, 0.32 * (1 - (glow - 7) / 13) ** 2)
    return undefined
  }
}
