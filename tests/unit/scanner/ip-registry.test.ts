import ipaddr from 'ipaddr.js'
import { describe, expect, it } from 'vitest'

import { BLOCKED_IPV4_CIDRS, BLOCKED_IPV6_CIDRS, isPublicAddress } from '@/lib/scanner/ip-policy'

import {
  IANA_IPV4_NOT_GLOBAL,
  IANA_IPV6_NOT_GLOBAL,
  type SpecialBlock,
} from '../../fixtures/iana-special-purpose'

/** First, middle (first host bit set) and last address of a block. */
function samples(cidr: string): (ipaddr.IPv4 | ipaddr.IPv6)[] {
  const [network, bits] = ipaddr.parseCIDR(cidr)
  const family = network.kind() === 'ipv4' ? ipaddr.IPv4 : ipaddr.IPv6
  const first = family.networkAddressFromCIDR(cidr)
  const last = family.broadcastAddressFromCIDR(cidr)
  const width = network.kind() === 'ipv4' ? 32 : 128
  if (bits >= width) return [first]
  const bytes = first.toByteArray()
  const index = Math.floor(bits / 8)
  bytes.splice(index, 1, (bytes.at(index) ?? 0) | (0x80 >> (bits % 8)))
  return [first, ipaddr.fromByteArray(bytes), last]
}

/**
 * The explicit lists alone, without ipaddr.js `range()`: they exist so a change in the
 * library's tables can never silently open a range (SC-12). IPv6 outside `2000::/3` is
 * refused by the global-unicast boundary.
 */
function refusedExplicitly(address: ipaddr.IPv4 | ipaddr.IPv6): boolean {
  const list = address.kind() === 'ipv4' ? BLOCKED_IPV4_CIDRS : BLOCKED_IPV6_CIDRS
  const listed = list.some((cidr) => {
    const [range, bits] = ipaddr.parseCIDR(cidr)
    return range.kind() === address.kind() && address.match(range, bits)
  })
  if (listed || address.kind() === 'ipv4') return listed
  return !address.match(ipaddr.parseCIDR('2000::/3'))
}

const rows = (blocks: readonly SpecialBlock[]) => blocks.map((b) => [b.cidr, b.name] as const)

describe.each([
  ['IPv4', IANA_IPV4_NOT_GLOBAL],
  ['IPv6', IANA_IPV6_NOT_GLOBAL],
])('IANA %s special-purpose registry (ADR-041)', (_family, blocks) => {
  it.each(rows(blocks))('%s (%s) is covered by the explicit block list', (cidr) => {
    for (const address of samples(cidr)) {
      expect(refusedExplicitly(address), address.toString()).toBe(true)
    }
  })

  it.each(rows(blocks))('%s (%s) is refused by isPublicAddress', (cidr) => {
    // IPv4-mapped IPv6 is judged as the IPv4 it carries, by design (SC-12): only its
    // non-public IPv4 samples (0.0.0.0, 255.255.255.255) must be refused here.
    const mapped = cidr === '::ffff:0:0/96'
    for (const address of samples(cidr)) {
      const text = address.toString()
      if (mapped && text === '::ffff:8000:0') continue
      expect(isPublicAddress(text), text).toBe(false)
    }
  })
})

it('still accepts ordinary public addresses next to the blocks', () => {
  for (const address of ['8.8.8.8', '1.1.1.1', '93.184.215.14', '2606:4700::1111', '2001:200::1'])
    expect(isPublicAddress(address), address).toBe(true)
})
