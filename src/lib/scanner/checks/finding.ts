import { truncate } from '../header-utils'
import { EVIDENCE_MAX } from '../limits'
import { ruleMeta } from '../rules'
import type {
  Evidence,
  Finding,
  FindingNote,
  MessageParams,
  RuleId,
  Severity,
  Status,
} from '../types'

export { EVIDENCE_MAX } from '../limits'

export interface FindingSpec {
  status: Status
  /** Required for warn/fail; pass and info findings default to `info`. */
  severity?: Severity
  deduction?: number
  variant: string
  params?: MessageParams
  evidence?: Evidence
  notes?: FindingNote[]
}

/**
 * Builds a finding with the category from the registry, `messageKey = <id>.<variant>`,
 * truncated evidence and a zero deduction unless the status is warn or fail.
 */
export function finding(id: RuleId, spec: FindingSpec): Finding {
  const scored = spec.status === 'warn' || spec.status === 'fail'
  const result: Finding = {
    id,
    category: ruleMeta(id).category,
    status: spec.status,
    severity: spec.severity ?? 'info',
    deduction: scored ? (spec.deduction ?? 0) : 0,
    messageKey: `${id}.${spec.variant}`,
  }
  if (spec.params) result.params = spec.params
  if (spec.notes && spec.notes.length > 0) result.notes = spec.notes
  if (spec.evidence) {
    const evidence: Evidence = {}
    if (spec.evidence.header !== undefined) evidence.header = spec.evidence.header
    if (spec.evidence.value !== undefined)
      evidence.value = truncate(spec.evidence.value, EVIDENCE_MAX)
    if (spec.evidence.detail !== undefined)
      evidence.detail = truncate(spec.evidence.detail, EVIDENCE_MAX)
    result.evidence = evidence
  }
  return result
}

/** Evidence for a header that may be absent. */
export function headerEvidence(header: string, value: string | undefined): Evidence {
  return value === undefined ? { header } : { header, value }
}
