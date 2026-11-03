import http from 'node:http'
import https from 'node:https'
import type { AddressInfo, Socket } from 'node:net'
import type tls from 'node:tls'

import type { Pem } from './certs'

export interface RecordedRequest {
  method: string
  url: string
  headers: http.IncomingHttpHeaders
  rawHeaderNames: string[]
}

export interface TestServer {
  port: number
  requests: RecordedRequest[]
  close(): Promise<void>
}

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void

function track(server: http.Server | https.Server, handler: Handler): Promise<TestServer> {
  const requests: RecordedRequest[] = []
  const sockets = new Set<Socket>()
  server.on('connection', (socket: Socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  server.on('tlsClientError', () => undefined)
  server.on('request', (req: http.IncomingMessage, res: http.ServerResponse) => {
    requests.push({
      method: req.method ?? '',
      url: req.url ?? '',
      headers: req.headers,
      rawHeaderNames: req.rawHeaders.filter((_, i) => i % 2 === 0).map((h) => h.toLowerCase()),
    })
    handler(req, res)
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({
        port,
        requests,
        close: () =>
          new Promise<void>((done) => {
            for (const socket of sockets) socket.destroy()
            server.close(() => {
              done()
            })
          }),
      })
    })
  })
}

/** Plain HTTP server on 127.0.0.1 with a random port. */
export function startHttpServer(handler: Handler): Promise<TestServer> {
  return track(http.createServer(), handler)
}

/** HTTPS server on 127.0.0.1 with a random port and the given certificate. */
export function startHttpsServer(
  handler: Handler,
  pem: Pem,
  extra: Partial<tls.TlsOptions> = {},
): Promise<TestServer> {
  return track(https.createServer({ key: pem.key, cert: pem.cert, ...extra }), handler)
}

/** Responds with a redirect. */
export function redirect(res: http.ServerResponse, location: string, status = 302): void {
  res.writeHead(status, { location })
  res.end()
}
