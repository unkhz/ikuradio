// A figure, as the matrix of dots sees it: a field of light over a plane,
// asked at any point what colour it is and how much of it there is. The
// background of the page is one such field (space.js, in a shader); the
// receiver's own likeness is another, drawn here, in the same terms.

export type Point = readonly [number, number]
export type Color = readonly [number, number, number]
/** The light at a point: its colour, and how much of it there is, 0 to 1. */
export type Light = { readonly color: Color; readonly energy: number }
export type Field = (x: number, y: number) => Light | undefined

export const hex = (code: string): Color => {
  const n = Number.parseInt(code.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export const mix = (a: Color, b: Color, t: number): Color => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

export const distance = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1])

/** How far a point lies from a straight stroke between two others. */
export function fromSegment(p: Point, a: Point, b: Point) {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
  const along = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
  return distance(p, [a[0] + dx * along, a[1] + dy * along])
}

/** How far a point lies from a stroke through all the given points. */
export const fromLine = (points: readonly Point[]) => (p: Point) => {
  let nearest = Infinity
  for (let i = 1; i < points.length; i++) nearest = Math.min(nearest, fromSegment(p, points[i - 1]!, points[i]!))
  return nearest
}

/**
 * A path of quadratic curves, as an SVG path's Q commands draw it, laid out
 * as the many short straight steps that follow it closely.
 */
export function curve(from: Point, ...bends: readonly (readonly [Point, Point])[]): Point[] {
  const points: Point[] = [from]
  let start = from
  for (const [control, end] of bends) {
    for (let i = 1; i <= 16; i++) {
      const t = i / 16
      const u = 1 - t
      points.push([
        u * u * start[0] + 2 * u * t * control[0] + t * t * end[0],
        u * u * start[1] + 2 * u * t * control[1] + t * t * end[1],
      ])
    }
    start = end
  }
  return points
}

/** How far a point lies inside a closed outline: below zero inside, above outside. */
export const fromOutline = (outline: readonly Point[]) => {
  const edge = fromLine([...outline, outline[0]!])
  return (p: Point) => {
    let inside = false
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const [a, b] = [outline[i]!, outline[j]!]
      if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside
    }
    return inside ? -edge(p) : edge(p)
  }
}

/** A point turned around a centre, by degrees. */
export function turn(p: Point, centre: Point, degrees: number): Point {
  const a = (degrees * Math.PI) / 180
  const [x, y] = [p[0] - centre[0], p[1] - centre[1]]
  return [centre[0] + x * Math.cos(a) - y * Math.sin(a), centre[1] + x * Math.sin(a) + y * Math.cos(a)]
}

// the same small noise the shader uses, so the two kinds of dots grain alike
const fract = (v: number) => v - Math.floor(v)
export const hash = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453)
export function noise(x: number, y: number) {
  const [ix, iy, fx, fy] = [Math.floor(x), Math.floor(y), fract(x), fract(y)]
  const [ux, uy] = [fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)]
  const top = hash(ix, iy) + (hash(ix + 1, iy) - hash(ix, iy)) * ux
  const bottom = hash(ix, iy + 1) + (hash(ix + 1, iy + 1) - hash(ix, iy + 1)) * ux
  return top + (bottom - top) * uy
}
export function fbm(x: number, y: number) {
  let [v, a] = [0, 0.5]
  for (let i = 0; i < 5; i++) {
    v += a * noise(x, y)
    x = x * 2.03 + 17.1
    y = y * 2.03 + 17.1
    a *= 0.5
  }
  return v
}
export const smoothstep = (from: number, to: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - from) / (to - from)))
  return t * t * (3 - 2 * t)
}
