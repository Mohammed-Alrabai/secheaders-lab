import tls from 'node:tls'

import type { PinnedAddress } from './dns'

/** SC-21: TLS inspection handshake timeout. */
export const TLS_INSPECT_TIMEOUT_MS = 3_000

export type TlsUnavailableReason =
  'TIMEOUT' | 'BUDGET_EXCEEDED' | 'CONNECT_FAILED' | 'HANDSHAKE_FAILED'

/** The certificate's public key (ADR-046): reported for information, never scored. */
export interface CertificateKey {
  type: 'RSA' | 'EC'
  bits: number
  /** Named curve for EC keys, e.g. `P-256`. */
  curve?: string
}

export interface CertificateSummary {
  hostnameMatches: boolean
  validFrom: string | null
  validTo: string | null
  /** Upstream data: treat as untrusted text (SC-29). */
  issuer: string | null
  /** `null` when the key type is not RSA or EC, or its size is unknown. */
  key: CertificateKey | null
}

export type TlsInspection =
  | ({
      available: true
      /** Negotiated protocol, e.g. `TLSv1.3`. */
      protocol: string | null
      /** Chain trusted and hostname matched (Node's verdict). */
      authorized: boolean
      /** Node / OpenSSL error code when not authorized, e.g. `CERT_HAS_EXPIRED`. */
      authorizationError: string | null
    } & CertificateSummary)
  | { available: false; reason: TlsUnavailableReason }

export interface TlsInspectOptions {
  signal: AbortSignal
  timeoutMs?: number
  /** Test-only port override; production always inspects 443. */
  port?: number
  /** Test-only extra trust anchors; production uses the system store. */
  ca?: string
}

function isoDate(value: string | undefined): string | null {
  const time = value ? Date.parse(value) : Number.NaN
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** RSA keys expose a modulus; EC keys a named curve. Other key types are not reported. */
function keyOf(cert: tls.PeerCertificate): CertificateKey | null {
  const fields = cert as Partial<Record<'bits' | 'nistCurve' | 'asn1Curve' | 'modulus', unknown>>
  const bits = typeof fields.bits === 'number' && fields.bits > 0 ? fields.bits : null
  if (bits === null) return null
  const curve = [fields.nistCurve, fields.asn1Curve].find(
    (c): c is string => typeof c === 'string' && c.length > 0 && c.length <= 32,
  )
  if (curve !== undefined) return { type: 'EC', bits, curve }
  if (typeof fields.modulus === 'string' && fields.modulus.length > 0) return { type: 'RSA', bits }
  return null
}

/**
 * Extracts the fields we report from a peer certificate. An empty object (no certificate)
 * yields nulls and `hostnameMatches: false`.
 */
export function summarizeCertificate(
  cert: tls.PeerCertificate,
  hostname: string,
): CertificateSummary {
  const issuer = (cert.issuer as Partial<Record<'O' | 'CN', string | string[]>> | undefined) ?? {}
  return {
    hostnameMatches: tls.checkServerIdentity(hostname, cert) === undefined,
    validFrom: isoDate(cert.valid_from),
    validTo: isoDate(cert.valid_to),
    issuer: firstOf(issuer.O) ?? firstOf(issuer.CN) ?? null,
    key: keyOf(cert),
  }
}

/**
 * Reads the certificate and negotiated protocol from the pinned address (SC-21).
 *
 * The socket uses `rejectUnauthorized: false` **only** so that invalid certificates can be
 * reported; no application data is ever written to it, and it is destroyed right after the
 * handshake. It also accepts TLS 1.0/1.1 so old protocols are detected rather than reported
 * as "no HTTPS" (ADR-018). Page fetches keep strict TLS (`safe-fetch.ts`).
 */
export function inspectTls(
  pinned: PinnedAddress,
  options: TlsInspectOptions,
): Promise<TlsInspection> {
  const { signal, timeoutMs = TLS_INSPECT_TIMEOUT_MS, port = 443, ca } = options
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve({ available: false, reason: 'BUDGET_EXCEEDED' })
      return
    }
    let connected = false
    const socket = tls.connect({
      host: pinned.address, // SC-13: the validated IP, no new resolution
      port,
      servername: pinned.hostname,
      rejectUnauthorized: false, // SC-21: read-only inspection, no data is sent
      minVersion: 'TLSv1', // ADR-018
      ciphers: 'DEFAULT:@SECLEVEL=0', // ADR-018
      ALPNProtocols: ['http/1.1'],
      ...(ca === undefined ? {} : { ca }),
    })

    // Idempotent: a late event after the first result only re-destroys the socket.
    const finish = (result: TlsInspection) => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      socket.destroy()
      resolve(result)
    }
    const onAbort = () => {
      finish({ available: false, reason: 'BUDGET_EXCEEDED' })
    }
    const timer = setTimeout(() => {
      finish({ available: false, reason: 'TIMEOUT' })
    }, timeoutMs)

    signal.addEventListener('abort', onAbort, { once: true })
    socket.once('connect', () => {
      connected = true
    })
    socket.once('secureConnect', () => {
      finish({
        available: true,
        protocol: socket.getProtocol(),
        authorized: socket.authorized,
        // Node stores the verification error code here as a string despite the typings.
        authorizationError: socket.authorized ? null : String(socket.authorizationError),
        ...summarizeCertificate(socket.getPeerCertificate(), pinned.hostname),
      })
    })
    socket.once('error', () => {
      finish({ available: false, reason: connected ? 'HANDSHAKE_FAILED' : 'CONNECT_FAILED' })
    })
  })
}
