import { describe, expect, it } from 'bun:test'
import { parseLoudness, silence } from './loudness.js'

const said = (i: string, tp: string) => `[Parsed_loudnorm_0 @ 0x1]
{
	"input_i" : "${i}",
	"input_tp" : "${tp}",
	"input_lra" : "3.00",
	"input_thresh" : "-28.69",
	"output_i" : "-22.58",
	"target_offset" : "-1.42"
}
size=N/A time=00:00:06.60`

describe('parseLoudness', () => {
  it('reads the loudness ffmpeg heard', () => {
    expect(parseLoudness(said('-18.45', '-7.92'))).toEqual({ lufs: -18.45, peak: -7.92 })
  })

  it('says silence when there is nothing to hear', () => {
    expect(parseLoudness(said('-inf', '-inf'))).toEqual({ lufs: silence, peak: silence })
  })

  it('says nothing when ffmpeg said nothing it could read', () => {
    expect(parseLoudness('no such file')).toBeUndefined()
  })
})
