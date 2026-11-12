// The receiver's likeness: lost, from another world, a little broken, and
// a radio still. It began as a sketch of a creature, a shell on three legs.
// It is drawn now as what it is: a chassis of grey-blue haze with a rim
// catching the light and one corner chipped away; a speaker of slats; a
// tuning band lit from behind, its ticks and its amber needle; a knob to
// turn it, and a small one with a violet eye; a carrying handle snapped on
// one side and hanging; a crack across the front; two rubber feet; a violet
// cord trailing loose; and a telescopic antenna, bent near the top, whose
// tip is the brightest thing in it, warm enough to bleed into the dark.

import { curve, distance, fbm, fromLine, hex, mix, turn, type Color, type Field, type Light, type Point } from './lib/field.js'

const rim = hex('#a9c4b3')
const hull = hex('#38536c')
const hullLit = hex('#6284a4')
const dark = hex('#0d141b')
const amber = hex('#ffb347')
const violet = hex('#c77dff')
const grey = hex('#6c7f76')

/** How far a point lies inside a box with rounded corners: below zero inside. */
const box =
  (centre: Point, half: Point, round: number) =>
  ([x, y]: Point) => {
    const qx = Math.abs(x - centre[0]) - (half[0] - round)
    const qy = Math.abs(y - centre[1]) - (half[1] - round)
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - round
  }

const fract = (v: number) => v - Math.floor(v)

// the chassis, its top left corner chipped away
const chassisBox = box([103, 118], [70, 48], 16)
const chip: Point = [36, 70]
const chassis = (p: Point) => Math.max(chassisBox(p), 13 - distance(p, chip))

const grille = box([66, 124], [22, 32], 6)
const band = box([136, 92], [27, 9], 3)
const handle = fromLine([[58, 70], [64, 50], [104, 47], [113, 58]])
const antenna = fromLine([[160, 70], [167, 40]])
const antennaThin = fromLine([[167, 40], [172, 22]])
const antennaBent = fromLine([[172, 22], [183, 12]])
const mount: Point = [160, 70]
const tip: Point = [183, 12]
const needle = fromLine([[147, 85], [147, 100]])
const crack = fromLine([[96, 70], [102, 83], [97, 94], [104, 108], [100, 116]])
const feet = [box([62, 170], [9, 4], 2), box([146, 170], [9, 4], 2)]
const cord = fromLine(curve([34, 150], [[14, 164], [26, 180]], [[38, 194], [22, 204]]))
const tuner: Point = [134, 134]
const knob: Point = [161, 150]
const index = fromLine([tuner, [140, 124]])

const lit = (color: Color, energy: number): Light => ({ color, energy })

/** The receiver, in a plane 200 across and 200 down, leaning a little as it always has. */
export function receiver(lean = -9): Field {
  return (x, y) => {
    const p = turn([x, y], [104, 112], -lean)

    // the brightest things first: the antenna's tip, the needle, the eye
    if (distance(p, tip) < 6.5) return lit(amber, 1)
    if (needle(p) < 1.6 && Math.abs(band(p)) > 1.2 && band(p) < 0) return lit(amber, 1)
    if (distance(p, knob) < 2.5) return lit(violet, 1)

    // the tuning knob, with its index
    const fromTuner = distance(p, tuner) - 13
    if (Math.abs(fromTuner) < 2.3) return lit(rim, 0.95)
    if (fromTuner < 0) return index(p) < 1.6 ? lit(amber, 0.85) : lit(dark, 0.06)
    const fromKnob = distance(p, knob) - 6
    if (Math.abs(fromKnob) < 1.4) return lit(rim, 0.8)
    if (fromKnob < 0) return lit(dark, 0.05)

    // the tuning band: a frame, ticks along its top, lit faintly from behind
    const inBand = band(p)
    if (Math.abs(inBand) < 1.3) return lit(rim, 0.75)
    if (inBand < 0) {
      if (p[1] < 89 && fract((p[0] - 110) / 7) < 0.28) return lit(rim, 0.55)
      return lit(amber, 0.14)
    }

    if (crack(p) < 1.4) return lit(dark, 0.02)

    // the speaker: slats, and the dark between them
    const inGrille = grille(p)
    if (Math.abs(inGrille) < 1.2) return lit(grey, 0.55)
    if (inGrille < 0) return fract((p[1] - 94) / 11) < 0.5 ? lit(dark, 0.02) : lit(grey, 0.62)

    const inside = chassis(p)
    if (Math.abs(inside) < 2.3) return lit(rim, 0.9)
    if (inside < 0) {
      // the hull is lit from above and the right, unevenly, the way old paint wears
      const wear = fbm(p[0] * 0.05, p[1] * 0.05)
      const light = Math.max(0, Math.min(1, 0.65 - (p[1] - 60) / 160 + (p[0] - 100) / 300 + (wear - 0.5)))
      return lit(mix(hull, hullLit, light), 0.32 + 0.3 * light)
    }

    if (distance(p, mount) < 4) return lit(grey, 0.8)
    if (antenna(p) < 2) return lit(rim, 0.85)
    if (antennaThin(p) < 1.5) return lit(rim, 0.8)
    if (antennaBent(p) < 1.2) return lit(rim, 0.75)
    if (handle(p) < 2.4) return lit(grey, 0.75)
    if (feet.some((foot) => foot(p) < 0)) return lit(grey, 0.7)
    if (cord(p) < 1.8) return lit(violet, 0.9)

    // the tip's warmth, spilling out into the dark
    const glow = distance(p, tip)
    if (glow < 19) return lit(amber, 0.32 * (1 - (glow - 6.5) / 12.5) ** 2)
    return undefined
  }
}
