import { ReadStream } from 'node:fs'
import {
  IncomingMessage,
  OutgoingHttpHeaders,
  ServerResponse,
  createServer as createHttpServer,
} from 'node:http'
import { ReadableStream } from 'node:stream/web'

export function createServer(
  getStream: (
    req: IncomingMessage,
    res: ServerResponse<IncomingMessage>,
  ) => Promise<{
    stream?: ReadStream | ReadableStream
    headers?: OutgoingHttpHeaders
  }>,
) {
  const server = createHttpServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(404)
      return res.end()
    }

    try {
      const { stream, headers } = await getStream(req, res)

      if (res.writableEnded) {
        return
      }

      if (!stream) {
        res.writeHead(404)
        return res.end()
      }

      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Private-Network': 'true',
        ...headers,
      })

      for await (const chunk of stream) {
        res.write(chunk)
      }

      res.end()
    } catch (error) {
      res.writeHead(500)
      res.end()
      return
    }
  })
  return server
}
