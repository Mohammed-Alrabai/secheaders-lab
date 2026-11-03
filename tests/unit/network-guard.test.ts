import dns from 'node:dns'
import { lookup as esmLookup } from 'node:dns/promises'
import http from 'node:http'
import net from 'node:net'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { NetworkAccessBlockedError, isLoopbackHost } from '../setup/network-guard'

/** Fake resolver honouring Node's `{ all: true }` lookup contract. */
function fixedLookup(address: string): net.LookupFunction {
  return (_host, opts, cb) => {
    if (opts.all) {
      cb(null, [{ address, family: 4 }])
    } else {
      cb(null, address, 4)
    }
  }
}

describe('test network guard', () => {
  let server: http.Server
  let port = 0

  beforeAll(async () => {
    server = http.createServer((_req, res) => res.end('ok'))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('no port')
    port = address.port
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve()
      })
    })
  })

  it.each([
    'localhost',
    'app.localhost',
    '127.0.0.1',
    '127.1.2.3',
    '::1',
    '[::1]',
    '::ffff:127.0.0.1',
  ])('treats %s as loopback', (host) => {
    expect(isLoopbackHost(host)).toBe(true)
  })

  it.each(['example.com', '93.184.215.14', '10.0.0.1', '::ffff:10.0.0.1', '2001:db8::1'])(
    'treats %s as non-loopback',
    (host) => {
      expect(isLoopbackHost(host)).toBe(false)
    },
  )

  it('blocks a socket to a public IP literal', () => {
    expect(() => net.connect({ host: '93.184.215.14', port: 80 })).toThrow(
      NetworkAccessBlockedError,
    )
  })

  it('blocks the (port, host) connect signature', () => {
    expect(() => net.connect(443, '1.1.1.1')).toThrow(NetworkAccessBlockedError)
  })

  it('destroys a socket whose injected lookup resolves to a public address', async () => {
    const socket = net.connect({
      host: 'public.example',
      port: 80,
      lookup: fixedLookup('93.184.215.14'),
    })
    const error = await new Promise<Error>((resolve) => socket.once('error', resolve))
    expect(error).toBeInstanceOf(NetworkAccessBlockedError)
  })

  it('blocks real DNS for non-loopback names (callback, promise and ESM forms)', async () => {
    expect(() => {
      dns.lookup('example.com', () => undefined)
    }).toThrow(NetworkAccessBlockedError)
    await expect(async () => dns.promises.lookup('example.com')).rejects.toThrow(
      NetworkAccessBlockedError,
    )
    await expect(async () => esmLookup('example.com')).rejects.toThrow(NetworkAccessBlockedError)
  })

  it('allows loopback HTTP to a local test server', async () => {
    const body = await new Promise<string>((resolve, reject) => {
      http
        .get({ host: '127.0.0.1', port, path: '/' }, (res) => {
          let data = ''
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString()
          })
          res.on('end', () => {
            resolve(data)
          })
        })
        .on('error', reject)
    })
    expect(body).toBe('ok')
  })

  it('allows a hostname whose injected lookup resolves to loopback', async () => {
    const socket = net.connect({ host: 'pinned.example', port, lookup: fixedLookup('127.0.0.1') })
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve)
      socket.once('error', reject)
    })
    socket.destroy()
  })
})
