import { z } from 'zod'

import { SCAN_ERROR_CODES } from './scanner/errors'
import { EVIDENCE_MAX, MAX_URL_LENGTH, RAW_HEADER_MAX } from './scanner/limits'
import { CAP_IDS, RULE_IDS, type ScanResult } from './scanner/types'

// The page CSP forbids eval (`03` §6). Without this, Zod probes `Function('')` on first
// parse in the browser; the probe is blocked and logged as a CSP issue (ADR-033).
z.config({ jitless: true })

/** SC-23: request body — exactly `{ url }`, unknown fields rejected. */
export const ScanRequestSchema = z.strictObject({
  url: z.string().min(1).max(MAX_URL_LENGTH),
})

export type ScanRequest = z.infer<typeof ScanRequestSchema>

const status = z.enum(['pass', 'warn', 'fail', 'info'])
const params = z.record(z.string(), z.union([z.string(), z.number()]))

const FindingSchema = z.strictObject({
  id: z.enum(RULE_IDS),
  category: z.enum(['headers', 'tls', 'cookies', 'disclosure']),
  status,
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  deduction: z.number().int().min(0).max(100),
  evidence: z.exactOptional(
    z.strictObject({
      header: z.exactOptional(z.string().max(256)),
      value: z.exactOptional(z.string().max(EVIDENCE_MAX)),
      detail: z.exactOptional(z.string().max(EVIDENCE_MAX)),
    }),
  ),
  messageKey: z.string().max(128),
  params: z.exactOptional(params),
  notes: z.exactOptional(
    z.array(z.strictObject({ messageKey: z.string().max(128), params: z.exactOptional(params) })),
  ),
})

/**
 * SC-28: the response contract (`02` §4). Strict objects make any unexpected field fail
 * validation, so internal data can never leak through the API by accident.
 */
export const ScanResultSchema = z.strictObject({
  schemaVersion: z.literal(1),
  scoringVersion: z.number().int().positive(),
  scannedAt: z.iso.datetime(),
  durationMs: z.number().int().min(0),
  target: z.strictObject({
    input: z.string().max(MAX_URL_LENGTH),
    finalUrl: z.string().max(MAX_URL_LENGTH),
    redirectChain: z
      .array(z.strictObject({ url: z.string().max(MAX_URL_LENGTH), status: z.number().int() }))
      .max(6),
    httpStatus: z.number().int().min(100).max(599),
  }),
  tls: z.strictObject({
    available: z.boolean(),
    protocol: z.exactOptional(z.string().max(32)),
    validTo: z.exactOptional(z.iso.datetime()),
    issuer: z.exactOptional(z.string().max(512)),
    authorized: z.exactOptional(z.boolean()),
  }),
  score: z.number().int().min(0).max(100),
  grade: z.enum(['A+', 'A', 'B', 'C', 'D', 'F']),
  capsApplied: z.array(z.enum(CAP_IDS)),
  summary: z.strictObject({
    pass: z.number().int(),
    warn: z.number().int(),
    fail: z.number().int(),
    info: z.number().int(),
  }),
  findings: z.array(FindingSchema).max(64),
  rawHeaders: z
    .array(z.strictObject({ name: z.string().max(256), value: z.string().max(RAW_HEADER_MAX) }))
    .max(100),
}) satisfies z.ZodType<ScanResult>

/** Error body (`02` §4, SC-26): a public code only. */
export const ErrorBodySchema = z.strictObject({
  error: z.strictObject({ code: z.enum(SCAN_ERROR_CODES) }),
})

export type ErrorBody = z.infer<typeof ErrorBodySchema>
