import { isIP } from 'node:net'

import ipaddr from 'ipaddr.js'

import { ScanError } from './errors'

type Cidr = [ipaddr.IPv4 | ipaddr.IPv6, number]

function cidrs(list: readonly string[]): Cidr[] {
  return list.map((cidr) => ipaddr.parseCIDR(cidr))
}

/**
 * SC-12: non-public IPv4 ranges, checked explicitly on top of ipaddr.js `range()` so a
 * future change in the library's tables can never silently open a range.
 */
export const BLOCKED_IPV4_CIDRS: readonly string[] = [
  '0.0.0.0/8', // unspecified / "this network"
  '10.0.0.0/8', // private
  '100.64.0.0/10', // CGNAT
  '127.0.0.0/8', // loopback
  '169.254.0.0/16', // link-local, incl. cloud metadata 169.254.169.254
  '172.16.0.0/12', // private
  '192.0.0.0/24', // IETF protocol assignments
  '192.0.2.0/24', // TEST-NET-1
  '192.88.99.0/24', // deprecated 6to4 relay anycast
  '192.168.0.0/16', // private
  '198.18.0.0/15', // benchmarking
  '198.51.100.0/24', // TEST-NET-2
  '203.0.113.0/24', // TEST-NET-3
  '224.0.0.0/4', // multicast
  '240.0.0.0/4', // reserved, incl. broadcast 255.255.255.255
]

/**
 * SC-12 + T-8: non-public IPv6 ranges inside or outside global unicast. Anything outside
 * `2000::/3` is rejected anyway; the entries below `2000::/3` document intent and guard
 * against regressions.
 */
export const BLOCKED_IPV6_CIDRS: readonly string[] = [
  '::/128', // unspecified
  '::1/128', // loopback
  '::/96', // deprecated IPv4-compatible
  '::ffff:0:0/96', // IPv4-mapped (unwrapped and re-checked as IPv4 before this list)
  '64:ff9b::/96', // NAT64 well-known prefix
  '64:ff9b:1::/48', // NAT64 local-use prefix
  '100::/64', // discard-only
  '2001::/32', // Teredo (embeds IPv4)
  '2001:2::/48', // benchmarking
  '2001:10::/28', // deprecated ORCHID
  '2001:20::/28', // ORCHIDv2
  '2001:db8::/32', // documentation
  '2002::/16', // 6to4 (embeds IPv4)
  '3fff::/20', // documentation
  'fc00::/7', // unique local
  'fe80::/10', // link-local
  'fec0::/10', // deprecated site-local
  'ff00::/8', // multicast
]

const BLOCKED_V4 = cidrs(BLOCKED_IPV4_CIDRS)
const BLOCKED_V6 = cidrs(BLOCKED_IPV6_CIDRS)
const GLOBAL_UNICAST_V6 = ipaddr.parseCIDR('2000::/3')

function inAny(address: ipaddr.IPv4 | ipaddr.IPv6, ranges: Cidr[]): boolean {
  return ranges.some(
    ([range, bits]) => range.kind() === address.kind() && address.match(range, bits),
  )
}

/**
 * True only for a canonical IP string that is public unicast (SC-11, SC-12). IPv4-mapped
 * IPv6 (`::ffff:a.b.c.d`) is unwrapped and judged as IPv4. Fails closed on anything else.
 */
export function isPublicAddress(address: string): boolean {
  // `net.isIP` rejects the legacy short/octal/hex IPv4 forms that ipaddr.js would accept.
  if (isIP(address) === 0) return false
  let parsed: ipaddr.IPv4 | ipaddr.IPv6
  try {
    parsed = ipaddr.process(address)
  } catch {
    return false
  }
  if (parsed.range() !== 'unicast') return false
  if (parsed.kind() === 'ipv4') return !inAny(parsed, BLOCKED_V4)
  const [globalUnicast, bits] = GLOBAL_UNICAST_V6
  return parsed.match(globalUnicast, bits) && !inAny(parsed, BLOCKED_V6)
}

/**
 * SC-11: throws unless the address is public unicast.
 *
 * @throws {ScanError} `BLOCKED_TARGET` / `NON_PUBLIC_ADDRESS`.
 */
export function assertPublicAddress(address: string): void {
  if (!isPublicAddress(address)) throw new ScanError('BLOCKED_TARGET', 'NON_PUBLIC_ADDRESS')
}
