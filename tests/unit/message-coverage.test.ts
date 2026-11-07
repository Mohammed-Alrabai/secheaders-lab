import { describe, expect, it } from 'vitest'

import ar from '../../messages/ar.json'
import en from '../../messages/en.json'
import { INSTRUCTION_KEYS, PLATFORMS } from '@/lib/remediation'
import { runChecks } from '@/lib/scanner/checks/index'
import { SCAN_ERROR_CODES } from '@/lib/scanner/errors'
import type { TlsInspection } from '@/lib/scanner/tls-inspect'
import { CAP_IDS, RULE_IDS, type HttpRedirectCheck } from '@/lib/scanner/types'

import { PERFECT_HEADERS, makeInput, validTls } from '../helpers/check-input'

type Tree = Record<string, unknown>

function lookup(tree: Tree, path: string[]): unknown {
  let node: unknown = tree
  for (const key of path) {
    if (typeof node !== 'object' || node === null || !Object.hasOwn(node, key)) return undefined
    node = Reflect.get(node, key)
  }
  return node
}

const H = (name: string, value: string): [string, string] => [name, value]

/** Inputs chosen so that every branch of every check runs at least once. */
const HEADER_SETS: [string, string][][] = [
  [],
  PERFECT_HEADERS,
  [H('strict-transport-security', 'max-age=0')],
  [H('strict-transport-security', 'max-age=100')],
  [H('strict-transport-security', 'max-age=31536000')],
  [H('strict-transport-security', 'max-age=15552000; includeSubDomains')],
  [H('content-security-policy-report-only', "default-src 'self'")],
  [H('content-security-policy', "script-src * 'unsafe-inline' 'unsafe-eval'")],
  [H('content-security-policy', "object-src 'none'")],
  [H('x-frame-options', 'ALLOW-FROM https://x.example'), H('x-content-type-options', 'bogus')],
  [H('referrer-policy', 'bogus'), H('x-xss-protection', '1; mode=block')],
  [H('referrer-policy', 'unsafe-url'), H('x-xss-protection', '0')],
  [H('x-frame-options', 'DENY'), H('x-frame-options', 'DENY')],
  [H('set-cookie', 'a=1; SameSite=None'), H('set-cookie', '__Host-b=2')],
  [H('server', 'nginx/1.2.3'), H('x-powered-by', 'PHP'), H('x-aspnet-version', '4')],
  [H('server', 'nginx')],
]

const TLS_CASES: TlsInspection[] = [
  validTls(),
  validTls(5),
  validTls(20),
  validTls(90, 'TLSv1.2'),
  validTls(90, 'TLSv1.1'),
  { ...validTls(), protocol: null, validTo: null },
  { available: false, reason: 'TIMEOUT' },
  ...[
    'CERT_HAS_EXPIRED',
    'CERT_NOT_YET_VALID',
    'ERR_TLS_CERT_ALTNAME_INVALID',
    'UNABLE_TO_GET_ISSUER_CERT',
  ].map((code) => ({ ...validTls(), authorized: false, authorizationError: code })),
]

const REDIRECTS: HttpRedirectCheck[] = [
  { kind: 'response', finalUrl: 'https://example.com/' },
  { kind: 'response', finalUrl: 'http://example.com/' },
  { kind: 'response', finalUrl: 'https://other.example.org/' },
  { kind: 'unreachable' },
  { kind: 'error' },
]

function emittedKeys(): Set<string> {
  const keys = new Set<string>()
  const add = (
    finalUrl: string,
    headers: [string, string][],
    tls: TlsInspection,
    httpRedirect: HttpRedirectCheck,
  ) => {
    for (const f of runChecks(makeInput({ finalUrl, headers, tls, httpRedirect }))) {
      keys.add(f.messageKey)
      for (const note of f.notes ?? []) keys.add(note.messageKey)
    }
  }
  for (const headers of HEADER_SETS)
    add('https://example.com/', headers, validTls(), REDIRECTS[0] ?? { kind: 'error' })
  add('http://example.com/', [H('set-cookie', 'a=1')], validTls(), { kind: 'error' })
  for (const tls of TLS_CASES) add('https://example.com/', [], tls, { kind: 'unreachable' })
  for (const redirect of REDIRECTS) add('https://example.com/', [], validTls(), redirect)
  return keys
}

const CATALOGS = { en: en as Tree, ar: ar as Tree }

describe('every message the app can show exists in both languages (06 §3, T-14)', () => {
  const keys = [...emittedKeys()].sort()

  it('the input battery reaches a broad set of variants', () => {
    expect(keys.length).toBeGreaterThan(70)
  })

  it.each(Object.entries(CATALOGS))('%s: every emitted rule state has text', (_lang, catalog) => {
    const missing = keys.filter((key) => {
      const [id = '', variant = ''] = key.split('.')
      return typeof lookup(catalog, ['rules', id, 'states', variant]) !== 'string'
    })
    expect(missing).toEqual([])
  })

  it.each(Object.entries(CATALOGS))('%s: every rule has a title and a why', (_lang, catalog) => {
    for (const id of RULE_IDS) {
      expect(typeof lookup(catalog, ['rules', id, 'title']), id).toBe('string')
      expect(typeof lookup(catalog, ['rules', id, 'why']), id).toBe('string')
    }
  })

  it.each(Object.entries(CATALOGS))(
    '%s: caps, error codes, platforms and instructions have text',
    (_lang, catalog) => {
      for (const cap of CAP_IDS)
        expect(typeof lookup(catalog, ['results', 'caps', cap]), cap).toBe('string')
      for (const code of [...SCAN_ERROR_CODES, 'NETWORK', 'MISSING_URL']) {
        expect(typeof lookup(catalog, ['errors', code, 'title']), code).toBe('string')
        expect(typeof lookup(catalog, ['errors', code, 'description']), code).toBe('string')
      }
      for (const p of PLATFORMS)
        expect(typeof lookup(catalog, ['results', 'platforms', p]), p).toBe('string')
      for (const k of INSTRUCTION_KEYS) {
        expect(typeof lookup(catalog, ['remediation', 'steps', k]), k).toBe('string')
      }
    },
  )

  it('no message uses rich-text tags by accident (<…> would need a renderer)', () => {
    for (const [lang, catalog] of Object.entries(CATALOGS)) {
      expect(JSON.stringify(catalog), lang).not.toMatch(/<[a-z]/i)
    }
  })
})
