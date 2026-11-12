// The throat, in a Receiver: Chimera, the same engine the Studio sings with,
// built from the same source into WebAssembly. A Session keeps every voice
// as its take, the score exactly as the throat was given it, and a Receiver
// sings it here, one singer at a time, into samples at 48 kHz. Sung by the
// same throat, a take sounds as the Studio heard it, sample for sample.
//
// The page sings in Workers (throat-worker.js); the terminal sings here
// directly. Both give the throat its compiled engine and its dictionary of
// English words, unzipped.

/** The rate the throat sings at, in samples a second. */
export const sampleRate = 48000

/**
 * Opens a throat. `engine` is the compiled module (or its bytes), and
 * `dictionary` the text of the CMU dictionary it reads words with.
 */
export async function openThroat(engine, dictionary) {
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
    /** Sings a take with a body (`male`, `female` or `child`): its samples, a copy of the throat's own. */
    sing(take, body) {
      call({ fn: 'sing', score: take, body, sampleRate })
      return new Float32Array(x.memory.buffer, x.chimera_sung_ptr(), x.chimera_sung_len()).slice()
    },
  }
}

/** The dictionary's text, from its gzipped bytes as they are fetched. */
export async function unzip(gzipped) {
  const stream = new Blob([gzipped]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}
