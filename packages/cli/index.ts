import { play } from 'vocals'
import { getEnv } from 'tools'

const { SERVER_HOST = '127.0.0.1', SERVER_PORT = 3000 } = getEnv()

async function run() {
  const response = await fetch(`http://${SERVER_HOST}:${SERVER_PORT}`)

  if (response.body) {
    // This does not work properly in Bun 0.6.12
    for await (const chunk of response.body) {
      const char = new TextDecoder().decode(chunk)
      if (char.startsWith('play:')) {
        play('../server/audio/' + char.slice(5, -1))
      } else {
        process.stdout.write(char)
      }
    }
  }
}

run()
