import ipaddr from 'ipaddr.js'
import { describe, expect, it, vi } from 'vitest'

import { ScanError } from '@/lib/scanner/errors'
import {
  BLOCKED_IPV4_CIDRS,
  BLOCKED_IPV6_CIDRS,
  assertPublicAddress,
  isPublicAddress,
} from '@/lib/scanner/ip-policy'

describe('SC-12 blocks every non-public IPv4 range', () => {
  it.each([
    ['unspecified 0.0.0.0/8', '0.0.0.0'],
    ['unspecified 0.0.0.0/8 (edge)', '0.255.255.255'],
    ['private 10/8', '10.0.0.1'],
    ['private 10/8 (edge)', '10.255.255.255'],
    ['private 172.16/12', '172.16.0.1'],
    ['private 172.16/12 (edge)', '172.31.255.255'],
    ['private 192.168/16', '192.168.1.1'],
    ['loopback 127/8', '127.0.0.1'],
    ['loopback 127/8 (edge)', '127.255.255.254'],
    ['link-local 169.254/16', '169.254.0.1'],
    ['cloud metadata', '169.254.169.254'],
    ['CGNAT 100.64/10', '100.64.0.1'],
    ['CGNAT 100.64/10 (edge)', '100.127.255.255'],
    ['IETF 192.0.0/24', '192.0.0.8'],
    ['TEST-NET-1 192.0.2/24', '192.0.2.1'],
    ['6to4 relay 192.88.99/24', '192.88.99.1'],
    ['benchmarking 198.18/15', '198.18.0.1'],
    ['benchmarking 198.18/15 (edge)', '198.19.255.255'],
    ['TEST-NET-2 198.51.100/24', '198.51.100.7'],
    ['TEST-NET-3 203.0.113/24', '203.0.113.9'],
    ['multicast 224/4', '224.0.0.1'],
    ['multicast 224/4 (edge)', '239.255.255.255'],
    ['reserved 240/4', '240.0.0.1'],
    ['broadcast', '255.255.255.255'],
  ])('SC-12 rejects %s (%s)', (_name, address) => {
    expect(isPublicAddress(address)).toBe(false)
  })
})

describe('SC-12 blocks every non-public IPv6 range', () => {
  it.each([
    ['unspecified ::', '::'],
    ['loopback ::1', '::1'],
    ['IPv4-compatible ::/96', '::7f00:1'],
    ['unique local fc00::/7', 'fc00::1'],
    ['unique local fd00::/8', 'fd00::1'],
    ['link-local fe80::/10', 'fe80::1'],
    ['link-local with zone id', 'fe80::1%eth0'],
    ['site-local fec0::/10', 'fec0::1'],
    ['multicast ff00::/8', 'ff02::1'],
    ['NAT64 64:ff9b::/96', '64:ff9b::7f00:1'],
    ['NAT64 local-use 64:ff9b:1::/48 (T-8)', '64:ff9b:1::a00:1'],
    ['discard 100::/64', '100::1'],
    ['Teredo 2001::/32 (T-8)', '2001:0:4136:e378:8000:63bf:3fff:fdd2'],
    ['benchmarking 2001:2::/48', '2001:2::1'],
    ['ORCHID 2001:10::/28', '2001:10::1'],
    ['ORCHIDv2 2001:20::/28', '2001:20::1'],
    ['documentation 2001:db8::/32', '2001:db8::1'],
    ['6to4 2002::/16 (T-8)', '2002:7f00:1::1'],
    ['documentation 3fff::/20', '3fff::1'],
  ])('SC-12 rejects %s (%s)', (_name, address) => {
    expect(isPublicAddress(address)).toBe(false)
  })
})

describe('SC-12 unwraps IPv4-mapped IPv6 and re-checks it as IPv4', () => {
  it.each([
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:10.0.0.1',
    '::ffff:169.254.169.254',
    '::FFFF:192.168.0.1',
  ])('SC-12 rejects IPv4-mapped %s', (address) => {
    expect(isPublicAddress(address)).toBe(false)
  })

  it('allows IPv4-mapped form of a public address', () => {
    expect(isPublicAddress('::ffff:93.184.215.14')).toBe(true)
  })

  it('rejects IPv4-translated ::ffff:0:a.b.c.d', () => {
    expect(isPublicAddress('::ffff:0:7f00:1')).toBe(false)
  })
})

describe('public unicast addresses are allowed', () => {
  it.each([
    '93.184.215.14',
    '8.8.8.8',
    '1.1.1.1',
    '172.15.255.255',
    '172.32.0.0',
    '100.128.0.1',
    '2606:4700:4700::1111',
    '2001:4860:4860::8888',
  ])('allows %s', (address) => {
    expect(isPublicAddress(address)).toBe(true)
    expect(() => {
      assertPublicAddress(address)
    }).not.toThrow()
  })
})

describe('fails closed on anything that is not a canonical IP', () => {
  it.each([
    '',
    'example.com',
    '127.1',
    '0x7f000001',
    '2130706433',
    '0177.0.0.1',
    '1.2.3.4.5',
    '::g',
    ' 8.8.8.8',
  ])('rejects %j', (value) => {
    expect(isPublicAddress(value)).toBe(false)
  })
})

describe('library failure', () => {
  it('fails closed if ipaddr.js throws on an address Node accepts', () => {
    const spy = vi.spyOn(ipaddr, 'process').mockImplementationOnce(() => {
      throw new Error('boom')
    })
    expect(isPublicAddress('8.8.8.8')).toBe(false)
    expect(spy).toHaveBeenCalledOnce()
  })
})

describe('assertPublicAddress', () => {
  it('SC-11 throws BLOCKED_TARGET for a non-public address', () => {
    let error: unknown
    try {
      assertPublicAddress('10.0.0.5')
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(ScanError)
    expect((error as ScanError).code).toBe('BLOCKED_TARGET')
    expect((error as ScanError).detail).toBe('NON_PUBLIC_ADDRESS')
  })
})

describe('explicit deny lists (defense in depth)', () => {
  it.each([...BLOCKED_IPV4_CIDRS, ...BLOCKED_IPV6_CIDRS])(
    'the network address of %s is blocked',
    (cidr) => {
      const [network = ''] = cidr.split('/')
      expect(isPublicAddress(network)).toBe(false)
    },
  )
})
