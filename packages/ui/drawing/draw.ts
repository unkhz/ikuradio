// Draws every picture the receiver shows of itself, as dots in the same
// matrix as the space behind the page: its likeness, its name, the card a
// shared link carries, and the small pictures a browser or a phone keeps of
// it. Each picture is one field seen through one grid, so no two sets of
// dots ever fall across each other. Run with `bun run draw`; the PNGs are
// made by rsvg-convert.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fbm, hash, hex, mix, noise, smoothstep, type Field, type Light } from './lib/field.js'
import { ico } from './lib/ico.js'
import { spell } from './lib/letters.js'
import { circles, sample, svg } from './lib/matrix.js'
import { receiver } from './receiver.js'

const pub = fileURLToPath(new URL('../public/', import.meta.url))
const scratch = mkdtempSync(join(tmpdir(), 'drawing-'))
const night = '#05070b'
const unlit: Light = { color: hex('#1c2833'), energy: 0.1 }

/** A field moved onto another plane: `cells` of its grid, `pitch` apart, beginning at `at`. */
// the receiver's own plane, with a little room around it; and closer in,
// for the smallest pictures, where only its hull, dial and antenna's tip count
const whole = { from: [-8, -12], across: 216 } as const
const close = { from: [12, -10], across: 184 } as const

const placed = (
  field: Field,
  at: readonly [number, number],
  pitch: number,
  cells: number,
  { from, across }: { from: readonly [number, number]; across: number } = whole,
): Field => {
  const scale = across / (cells * pitch)
  return (x, y) => field(from[0]! + (x - at[0]) * scale, from[1]! + (y - at[1]) * scale)
}

/** The first field with any light at a point is the one seen there. */
const over =
  (...fields: Field[]): Field =>
  (x, y) => {
    for (const field of fields) {
      const light = field(x, y)
      if (light) return light
    }
    return undefined
  }

/**
 * The name, on a little display, in cells `pitch` apart from `at`: lit dots
 * for the letters, the dots over the i's the antenna's amber, and the
 * unlit dots of the panel still there, faintly.
 */
function display(word: string, at: readonly [number, number], pitch: number): Field {
  const lit = spell(word)
  return (x, y) => {
    const column = Math.floor((x - at[0]) / pitch)
    const row = Math.floor((y - at[1]) / pitch)
    if (row < -1 || row > lit.length || column < -1 || column > lit[0]!.length) return undefined
    if (!lit[row]?.[column]) return unlit
    const tittle = row === 0 && !lit[1]![column]
    if (tittle) return { color: hex('#ffb347'), energy: 1 }
    const glimmer = 0.86 + 0.14 * hash(column * 1.7, row * 2.3)
    const [r, g, b] = mix(hex('#cfe6ff'), hex('#ffffff'), glimmer)
    return { color: [r * glimmer, g * glimmer, b * glimmer], energy: 1 }
  }
}

/** Space as the card shows it: the star cloud the page so often begins in, quieter. */
const space: Field = (x, y) => {
  const [qx, qy] = [x * 0.0022 + 3.1, y * 0.0022 + 1.7]
  const dust = smoothstep(0.48, 0.72, fbm(qx * 1.7 + 4, qy * 1.7 + 4)) * 0.75
  const haze = (0.42 + 0.24 * fbm(qx * 0.8, qy * 0.8)) * (1 - dust) * (0.55 + 0.7 * noise(qx * 38, qy * 38))
  const warmth = smoothstep(0.45, 0.75, fbm(qx * 1.1 - 2, qy * 1.1 - 2))
  if (hash(Math.floor(x / 10), Math.floor(y / 10)) > 0.994) return { color: hex('#d9e6ff'), energy: 0.6 }
  const color = mix(hex('#9eb3d9'), hex('#d9bf99'), warmth)
  return { color: [color[0] * 0.45, color[1] * 0.45, color[2] * 0.45], energy: haze * 0.5 }
}

/** Space a little quieter in a box, so words set over it can be read. */
const hushed =
  (field: Field, [left, top, right, bottom]: readonly number[]): Field =>
  (x, y) => {
    const light = field(x, y)
    if (!light) return light
    const inside = Math.min(x - left!, right! - x, y - top!, bottom! - y)
    return { ...light, energy: light.energy * (1 - 0.8 * smoothstep(-20, 30, inside)) }
  }

function png(name: string, image: string, width: number, height = width) {
  const from = join(scratch, `${name}.svg`)
  const to = join(scratch, `${name}.png`)
  writeFileSync(from, image)
  const made = spawnSync('rsvg-convert', ['-w', `${width}`, '-h', `${height}`, from, '-o', to])
  if (made.status !== 0) throw new Error(`rsvg-convert could not draw ${name}: ${made.stderr}`)
  return readFileSync(to)
}

const grid = (width: number, height: number, pitch: number) => ({
  columns: Math.round(width / pitch),
  rows: Math.round(height / pitch),
  from: [0, 0] as const,
  step: pitch,
  pitch,
})

// the likeness, for the page: forty-eight dots across, six apart, the
// pitch of the space behind it
writeFileSync(
  join(pub, 'receiver.svg'),
  svg(288, 288, circles(sample(placed(receiver(), [0, 0], 6, 48), grid(288, 288, 6))), 'The receiver: lost, from another world, a little broken.'),
)

// the name, as its display shows it
writeFileSync(
  join(pub, 'wordmark.svg'),
  svg(49 * 6, 9 * 6, circles(sample(display('ikuradio', [6, 6], 6), grid(49 * 6, 9 * 6, 6))), "The receiver's name, on its display."),
)

// the card a shared link carries, 1200 by 630, ten to a dot
const card = over(
  placed(receiver(), [60, 70], 10, 48),
  display('ikuradio', [600, 180], 10),
  hushed(space, [570, 150, 1150, 450]),
)
const cardImage = [
  `<rect width="1200" height="630" fill="${night}"/>`,
  circles(sample(card, { ...grid(1200, 630, 10), smallest: 0.05 })),
  `<g font-family="DejaVu Sans Mono, Menlo, monospace" font-size="27" fill="#9aaaa4">`,
  `<text x="590" y="340">a lost receiver, adrift online,</text>`,
  `<text x="590" y="382">still tuned to a song</text>`,
  `<text x="590" y="424">that never ends</text>`,
  `</g>`,
].join('\n')
writeFileSync(join(pub, 'card.png'), png('card', svg(1200, 630, cardImage, 'The card a shared link carries.'), 1200, 630))

// the pictures a phone or a browser keeps of it: the receiver on a patch of
// the dark display, well inside the circle any launcher may cut it to
function icon(size: number) {
  const pitch = size / 60
  const dots = sample(placed(receiver(), [6 * pitch, 5 * pitch], pitch, 48), { ...grid(size, size, pitch), unlit })
  return svg(size, size, `<rect width="${size}" height="${size}" fill="${night}"/>\n${circles(dots)}`, 'The receiver, as an app.')
}
for (const [file, size] of [
  ['icon-512.png', 512],
  ['icon-192.png', 192],
  ['apple-touch-icon.png', 180],
] as const) {
  writeFileSync(join(pub, file), png(file, icon(size), size))
}

// the tab's own: fewer, fuller dots on a dark tile, so they stay dots when
// small and are seen on a pale tab as well as a dark one
function tab(size: number) {
  const cells = size <= 32 ? 18 : 24
  const pitch = size / cells
  const dots = sample(placed(receiver(), [0, 0], pitch, cells, close), { ...grid(size, size, pitch), smallest: 0.22, largest: 0.52 })
  return svg(size, size, `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${night}"/>\n${circles(dots)}`, 'The receiver, in a tab.')
}
writeFileSync(join(pub, 'favicon.ico'), ico([16, 32, 48].map((size) => png(`tab-${size}`, tab(size), size))))

console.log(`drawn into ${pub}`)
