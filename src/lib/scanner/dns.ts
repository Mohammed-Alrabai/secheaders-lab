import dns from 'node:dns'
import { isIP } from 'node:net'

import { ScanError } from './errors'
import { assertPublicAddress } from './ip-policy'

/** SC-10: DNS resolution timeout. */
export const DNS_TIMEOUT_MS = 2_000

export interface ResolvedAddress {
  address: string
  family: number
}

/**
 * Hostname → addresses. Injected into the scanner so tests never touch real DNS
 * (`03` §9); production uses {@link systemResolver}.
 */
export interface Resolver {
  resolve(hostname: string): Promise<ResolvedAddress[]>
}

/** The validated address a connection must use (SC-13). */
export interface PinnedAddress {
  hostname: string
  address: string
  family: 4 | 6
}

/** SC-10: OS resolver, returning every A/AAAA record in resolver order. */
export const systemResolver: Resolver = {
  async resolve(hostname) {
    // `order: 'verbatim'` is Node 24's replacement for the deprecated `verbatim: true`.
    const records = await dns.promises.lookup(hostname, { all: true, order: 'verbatim' })
    return records.map(({ address, family }) => ({ address, family }))
  },
}

const NOT_FOUND_CODES = new Set(['ENOTFOUND', 'ENODATA', 'EAI_NONAME', 'EAI_NODATA'])

function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null
    ? (error as { code?: unknown }).code
    : undefined
}

function lookupWithDeadline(
  hostname: string,
  resolver: Resolver,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<ResolvedAddress[]> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      finish(() => {
        reject(new ScanError('TARGET_TIMEOUT', 'BUDGET_EXCEEDED'))
      })
    }
    const timer = setTimeout(() => {
      finish(() => {
        reject(new ScanError('TARGET_TIMEOUT', 'DNS_TIMEOUT'))
      })
    }, timeoutMs)
    let settled = false
    function finish(action: () => void) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      action()
    }
    signal.addEventListener('abort', onAbort, { once: true })
    resolver.resolve(hostname).then(
      (records) => {
        finish(() => {
          resolve(records)
        })
      },
      (error: unknown) => {
        finish(() => {
          if (error instanceof ScanError) reject(error)
          else if (NOT_FOUND_CODES.has(String(errorCode(error)))) {
            reject(new ScanError('DNS_NOT_FOUND', 'DNS_FAILURE'))
          } else reject(new ScanError('TARGET_UNREACHABLE', 'DNS_FAILURE'))
        })
      },
    )
  })
}

/**
 * Resolves `hostname` once and returns the single address to connect to.
 *
 * - SC-10: bounded by {@link DNS_TIMEOUT_MS} and the scan's abort signal.
 * - SC-11: every returned address must be public; one bad record blocks the target.
 * - SC-14: prefers the first IPv4 address, else the first IPv6 address.
 *
 * @throws {ScanError} `DNS_NOT_FOUND`, `BLOCKED_TARGET`, `TARGET_TIMEOUT` or `TARGET_UNREACHABLE`.
 */
export async function resolvePinnedAddress(
  hostname: string,
  resolver: Resolver,
  signal: AbortSignal,
  timeoutMs: number = DNS_TIMEOUT_MS,
): Promise<PinnedAddress> {
  if (signal.aborted) throw new ScanError('TARGET_TIMEOUT', 'BUDGET_EXCEEDED')
  const records = await lookupWithDeadline(hostname, resolver, signal, timeoutMs)
  const first = records[0]
  if (first === undefined) throw new ScanError('DNS_NOT_FOUND', 'NO_ADDRESSES')

  for (const { address } of records) assertPublicAddress(address) // SC-11: all, not some

  // Family comes from the address itself (already proven to be an IP), not the resolver.
  const chosen = records.find(({ address }) => isIP(address) === 4) ?? first
  return { hostname, address: chosen.address, family: isIP(chosen.address) === 4 ? 4 : 6 }
}
