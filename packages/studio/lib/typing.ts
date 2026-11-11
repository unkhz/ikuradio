// The typing of the words: when each character of a line appears, while it
// is sung. The Studio decides it once, and writes it into the Session, so
// that every Receiver types every line exactly as every other one does.

import { wrongness } from 'melody'

/**
 * When each character of a line is typed, in milliseconds from when the
 * voice enters. A comma is followed by a breath nine characters long, and
 * the line ends with a breath of ten. Each moment wavers a little, but
 * never so much that a character overtakes its neighbour. The last moment
 * is the line's end.
 */
export function typingMoments(
  line: string,
  voiced: number,
  name: string,
): number[] {
  const weights = [...line].map((char) => (char === ',' ? 10 : 1))
  const whole = weights.reduce((sum, w) => sum + w, 0) + 10
  const random = wrongness(`typing:${name}`)
  const moments: number[] = []
  let before = 0
  for (const weight of weights) {
    const gap = (voiced * 1000) / whole
    const moment = before + gap * (1 + 0.4 * (random() - 0.5))
    moments.push(moment)
    before += gap * weight
  }
  // the line break comes after the last breath
  moments.push(voiced * 1000)
  return moments
}
