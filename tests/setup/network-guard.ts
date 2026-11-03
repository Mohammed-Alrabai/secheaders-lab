import dns from 'node:dns'
import { syncBuiltinESMExports } from 'node:module'
import net from 'node:net'

/**
 * Test-only guard: automated tests must never reach the real internet (`05` §3,
 * `CLAUDE.md` §6). It fails closed:
 * - sockets to a non-loopback IP literal throw before any packet is sent;
 * - injected `lookup` functions (used for IP pinning) must resolve to loopback only;
 * - real DNS lookups for anything other than `localhost` throw.
 */

export class NetworkAccessBlockedError extends Error {
  constructor(target: string) {
    super(`Network access blocked in tests: ${target}`)
    this.name = 'NetworkAccessBlockedError'
  }
}

/** Returns true for `localhost`, `127.0.0.0/8`, `::1` and IPv4-mapped loopback. */
export function isLoopbackHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost')) return true
  if (h === '::1') return true
  const v4 = h.startsWith('::ffff:') ? h.slice('::ffff:'.length) : h
  return net.isIPv4(v4) && v4.startsWith('127.')
}

type LookupCallback = (err: Error | null, address?: unknown, family?: number) => void
type AnyLookup = (hostname: string, options: unknown, callback: LookupCallback) => void

function resolvedAddresses(address: unknown): unknown[] {
  if (Array.isArray(address)) {
    return address.map((entry: unknown) =>
      typeof entry === 'object' && entry !== null
        ? (entry as { address?: unknown }).address
        : entry,
    )
  }
  return [address]
}

function wrapLookup(lookup: AnyLookup, target: string): AnyLookup {
  return (hostname, options, callback) => {
    lookup(hostname, options, (err, address, family) => {
      if (err) {
        callback(err)
        return
      }
      const bad = resolvedAddresses(address).find(
        (a) => typeof a !== 'string' || !isLoopbackHost(a),
      )
      if (bad !== undefined) {
        const shown = typeof bad === 'string' ? bad : typeof bad
        callback(new NetworkAccessBlockedError(`${target} -> ${shown}`))
        return
      }
      callback(null, address, family)
    })
  }
}

/** `net.connect()` passes normalized args as `[[options, cb]]`; `socket.connect()` may get `(port, host)`. */
function connectOptions(args: unknown[]): Record<string, unknown> | undefined {
  const first: unknown = Array.isArray(args[0]) ? (args[0] as unknown[])[0] : args[0]
  return typeof first === 'object' && first !== null
    ? (first as Record<string, unknown>)
    : undefined
}

// Read via Reflect: we deliberately re-apply it with the socket as `this` below.
const rawConnect = Reflect.get(net.Socket.prototype, 'connect') as (...a: unknown[]) => net.Socket

net.Socket.prototype.connect = function guardedConnect(this: net.Socket, ...args: unknown[]) {
  const opts = connectOptions(args)
  const isPipe =
    typeof opts?.path === 'string' ||
    (opts === undefined && typeof args[0] === 'string' && Number.isNaN(Number(args[0])))
  if (!isPipe) {
    const host = opts ? opts.host : args[1]
    const target = typeof host === 'string' ? host : 'localhost'
    if (net.isIP(target.replace(/^\[|\]$/g, '')) !== 0 && !isLoopbackHost(target)) {
      throw new NetworkAccessBlockedError(target)
    }
    if (opts && typeof opts.lookup === 'function') {
      opts.lookup = wrapLookup(opts.lookup as AnyLookup, target)
    }
  }
  return rawConnect.apply(this, args)
}

function guardDns<T>(fn: T): T {
  const original = fn as (...a: unknown[]) => unknown
  return function guarded(this: unknown, hostname: unknown, ...rest: unknown[]) {
    if (typeof hostname !== 'string' || !isLoopbackHost(hostname)) {
      throw new NetworkAccessBlockedError(`dns ${String(hostname)}`)
    }
    return original.call(this, hostname, ...rest)
  } as T
}

dns.lookup = guardDns(dns.lookup)
dns.promises.lookup = guardDns(dns.promises.lookup)
dns.resolve = guardDns(dns.resolve)
dns.promises.resolve = guardDns(dns.promises.resolve)
syncBuiltinESMExports()
