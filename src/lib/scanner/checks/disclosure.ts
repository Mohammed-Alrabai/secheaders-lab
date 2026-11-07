import type { CheckInput, Finding } from '../types'

import { finding, headerEvidence } from './finding'

// `04` §4.4 specifies `\d+(\.\d+)+`, which matches exactly when a digit-dot-digit
// sequence occurs; this equivalent form is linear-time.
const VERSION = /\d\.\d/

/** INF-SERVER, INF-POWERED-BY, INF-ASPNET (`04` §4.4). */
export function checkDisclosure(input: CheckInput): Finding[] {
  const server = input.headers.get('server')
  const poweredBy = input.headers.get('x-powered-by')
  const aspnetHeader = ['x-aspnet-version', 'x-aspnetmvc-version'].find((h) => input.headers.has(h))

  const serverFinding =
    server === undefined
      ? finding('INF-SERVER', { status: 'pass', variant: 'absent' })
      : VERSION.test(server)
        ? finding('INF-SERVER', {
            status: 'warn',
            severity: 'low',
            deduction: 3,
            variant: 'version',
            evidence: headerEvidence('server', server),
          })
        : finding('INF-SERVER', {
            status: 'info',
            variant: 'present',
            evidence: headerEvidence('server', server),
          })

  const poweredByFinding =
    poweredBy === undefined
      ? finding('INF-POWERED-BY', { status: 'pass', variant: 'absent' })
      : finding('INF-POWERED-BY', {
          status: 'warn',
          severity: 'low',
          deduction: 3,
          variant: 'present',
          evidence: headerEvidence('x-powered-by', poweredBy),
        })

  const aspnetFinding =
    aspnetHeader === undefined
      ? finding('INF-ASPNET', { status: 'pass', variant: 'absent' })
      : finding('INF-ASPNET', {
          status: 'warn',
          severity: 'low',
          deduction: 3,
          variant: 'present',
          evidence: headerEvidence(aspnetHeader, input.headers.get(aspnetHeader)),
        })

  return [serverFinding, poweredByFinding, aspnetFinding]
}
