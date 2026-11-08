/**
 * Address blocks that the IANA Special-Purpose Address Registries do **not** mark as
 * globally reachable ("Globally Reachable" = False, N/A, or blank for deprecated blocks).
 * The scanner must refuse every address in these blocks (SC-11, SC-12, ADR-041).
 *
 * Sources (CSV exports of the official registries), retrieved 2026-11-08:
 * - https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry-1.csv
 * - https://www.iana.org/assignments/iana-ipv6-special-registry/iana-ipv6-special-registry-1.csv
 *
 * Blocks marked globally reachable (for example AS112, AMT, ORCHIDv2) are left out: the
 * policy may refuse them too, which is stricter and never unsafe. Review this list when
 * the registries change; the test fails closed on any block it does not cover.
 */
export interface SpecialBlock {
  cidr: string
  name: string
}

export const IANA_IPV4_NOT_GLOBAL: readonly SpecialBlock[] = [
  { cidr: '0.0.0.0/8', name: '"This network"' },
  { cidr: '0.0.0.0/32', name: '"This host on this network"' },
  { cidr: '10.0.0.0/8', name: 'Private-Use' },
  { cidr: '100.64.0.0/10', name: 'Shared Address Space' },
  { cidr: '127.0.0.0/8', name: 'Loopback' },
  { cidr: '169.254.0.0/16', name: 'Link Local' },
  { cidr: '172.16.0.0/12', name: 'Private-Use' },
  { cidr: '192.0.0.0/24', name: 'IETF Protocol Assignments' },
  { cidr: '192.0.0.0/29', name: 'IPv4 Service Continuity Prefix' },
  { cidr: '192.0.0.8/32', name: 'IPv4 dummy address' },
  { cidr: '192.0.0.170/32', name: 'NAT64/DNS64 Discovery' },
  { cidr: '192.0.0.171/32', name: 'NAT64/DNS64 Discovery' },
  { cidr: '192.0.2.0/24', name: 'Documentation (TEST-NET-1)' },
  { cidr: '192.88.99.0/24', name: 'Deprecated (6to4 Relay Anycast)' },
  { cidr: '192.88.99.2/32', name: '6a44-relay anycast address' },
  { cidr: '192.168.0.0/16', name: 'Private-Use' },
  { cidr: '198.18.0.0/15', name: 'Benchmarking' },
  { cidr: '198.51.100.0/24', name: 'Documentation (TEST-NET-2)' },
  { cidr: '203.0.113.0/24', name: 'Documentation (TEST-NET-3)' },
  { cidr: '240.0.0.0/4', name: 'Reserved' },
  { cidr: '255.255.255.255/32', name: 'Limited Broadcast' },
]

export const IANA_IPV6_NOT_GLOBAL: readonly SpecialBlock[] = [
  { cidr: '::1/128', name: 'Loopback Address' },
  { cidr: '::/128', name: 'Unspecified Address' },
  { cidr: '::ffff:0:0/96', name: 'IPv4-mapped Address' },
  { cidr: '64:ff9b:1::/48', name: 'IPv4-IPv6 Translat.' },
  { cidr: '100::/64', name: 'Discard-Only Address Block' },
  { cidr: '100:0:0:1::/64', name: 'Dummy IPv6 Prefix' },
  // False "unless a more specific allocation states otherwise": only the globally
  // reachable sub-blocks are exempt, so the rest of the /23 must be refused.
  { cidr: '2001::/23', name: 'IETF Protocol Assignments' },
  { cidr: '2001::/32', name: 'TEREDO' },
  { cidr: '2001:2::/48', name: 'Benchmarking' },
  { cidr: '2001:10::/28', name: 'Deprecated (previously ORCHID)' },
  { cidr: '2001:db8::/32', name: 'Documentation' },
  { cidr: '2002::/16', name: '6to4' },
  { cidr: '3fff::/20', name: 'Documentation' },
  { cidr: '5f00::/16', name: 'Segment Routing (SRv6) SIDs' },
  { cidr: 'fc00::/7', name: 'Unique-Local' },
  { cidr: 'fe80::/10', name: 'Link-Local Unicast' },
]
