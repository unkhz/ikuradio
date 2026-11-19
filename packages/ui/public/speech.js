// The speaking throat, in a Receiver and in the Studio (plan "Intro with
// Rezzy"): Chimera's Speak mode, built from its own pinned revision into its
// own WebAssembly (throat/speech/), apart from the throat the choir sings with
// (throat.js), which it never touches. A DJ's words go in as text; what comes
// out is the speech as samples at 48 kHz, and when each of its sounds is said.

/** The rate the speaking throat speaks at, in samples a second. */
export const speechRate = 48000

/**
 * Opens a speaking throat. `engine` is the compiled module (or its bytes),
 * and `dictionary` the text of the CMU dictionary it reads words with.
 */
export async function openSpeech(engine, dictionary) {
  const module = engine instanceof WebAssembly.Module ? engine : await WebAssembly.compile(engine)
  const instance = await WebAssembly.instantiate(module, {})
  const x = instance.exports
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const call = (request) => {
    const bytes = encoder.encode(JSON.stringify(request))
    const at = x.chimera_alloc(bytes.length)
    new Uint8Array(x.memory.buffer, at, bytes.length).set(bytes)
    const failed = x.chimera_call(at, bytes.length)
    x.chimera_free(at, bytes.length)
    const answer = JSON.parse(
      decoder.decode(new Uint8Array(x.memory.buffer, x.chimera_result_ptr(), x.chimera_result_len())),
    )
    if (failed) throw new Error(answer.error)
    return answer
  }

  call({ fn: 'g2pLoad', text: dictionary })

  return {
    /**
     * Says `request`: `text`, `body` (`male`, `female` or `child`), and the
     * voice's own: `f0` (Hz), `rate` (1 as usual), `accent`, `pressure`,
     * `tension`, `breathiness`. Returns the samples, a copy of the throat's
     * own, when the speech ends, and its segments: each sound, when it
     * begins and ends, its stress if it has one, and what kind it is.
     */
    say(request) {
      const said = call({ fn: 'say', sampleRate: speechRate, ...request })
      const samples = new Float32Array(x.memory.buffer, x.chimera_sung_ptr(), x.chimera_sung_len()).slice()
      return { samples, end: said.end, segments: said.segments }
    },
  }
}
