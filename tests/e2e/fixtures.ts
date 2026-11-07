import { runChecks } from '../../src/lib/scanner/checks/index'
import { computeScore } from '../../src/lib/scanner/scoring'
import type { ScanResult } from '../../src/lib/scanner/types'
import { makeInput } from '../helpers/check-input'

/** U+202E built from its code point so the character never appears in source. */
const RLO = String.fromCodePoint(0x202e)

/** A realistic ScanResult produced by the real engine (no network involved). */
export function sampleResult(): ScanResult {
  const headers: [string, string][] = [
    ['strict-transport-security', 'max-age=31536000'],
    ['x-content-type-options', 'nosniff'],
    ['server', 'nginx/1.24.0'],
    // SSRF case 22 (UI half): markup and a bidi override arriving as latin1 bytes.
    [
      'x-evil',
      `<script>window.__pwned = true</script>${Buffer.from(RLO, 'utf8').toString('latin1')}gnp.exe`,
    ],
    ['set-cookie', 'sid=TOP-SECRET; Path=/; Secure'],
  ]
  const findings = runChecks(makeInput({ headers }))
  const summary = { pass: 0, warn: 0, fail: 0, info: 0 }
  for (const f of findings) summary[f.status] += 1
  return {
    schemaVersion: 1,
    scoringVersion: 1,
    scannedAt: '2026-11-07T12:00:00.000Z',
    durationMs: 812,
    target: {
      input: 'example.com',
      finalUrl: 'https://example.com/',
      redirectChain: [
        { url: 'http://example.com/', status: 301 },
        { url: 'https://example.com/', status: 200 },
      ],
      httpStatus: 200,
    },
    tls: {
      available: true,
      protocol: 'TLSv1.3',
      validTo: '2027-02-01T00:00:00.000Z',
      issuer: 'Test CA',
      authorized: true,
    },
    ...computeScore(findings),
    summary,
    findings,
    rawHeaders: headers.map(([name, value]) => ({
      name,
      value: name === 'set-cookie' ? 'sid=[redacted]; Path=/; Secure' : value,
    })),
  }
}
