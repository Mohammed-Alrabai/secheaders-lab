import { generate } from 'selfsigned'

/** A PEM key pair. Generated at test time and never written to disk (`05` §4). */
export interface Pem {
  key: string
  cert: string
}

const DAY = 24 * 60 * 60 * 1000

/** A throwaway CA for the test run, trusted only via the `ca` option of test clients. */
export async function createTestCa(): Promise<Pem> {
  const pems = await generate([{ name: 'commonName', value: 'SecHeaders Lab Test CA' }], {
    keyType: 'ec',
    algorithm: 'sha256',
    notBeforeDate: new Date(Date.now() - DAY),
    notAfterDate: new Date(Date.now() + 2 * DAY),
    extensions: [
      { name: 'basicConstraints', cA: true, critical: true },
      {
        name: 'keyUsage',
        keyCertSign: true,
        cRLSign: true,
        digitalSignature: true,
        critical: true,
      },
    ],
  })
  return { key: pems.private, cert: pems.cert }
}

export interface LeafOptions {
  hostnames: string[]
  notBefore?: Date
  notAfter?: Date
  /** Omit to sign with the CA; `null` for a self-signed (untrusted) leaf. */
  ca?: Pem | null
}

/** Issues a server certificate for the given DNS names. */
export async function issueLeaf(ca: Pem, options: LeafOptions): Promise<Pem> {
  const signer = options.ca === null ? undefined : (options.ca ?? ca)
  const pems = await generate([{ name: 'commonName', value: options.hostnames[0] ?? 'leaf' }], {
    keyType: 'ec',
    algorithm: 'sha256',
    notBeforeDate: options.notBefore ?? new Date(Date.now() - DAY),
    notAfterDate: options.notAfter ?? new Date(Date.now() + 90 * DAY),
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      {
        name: 'subjectAltName',
        altNames: options.hostnames.map((value) => ({ type: 2 as const, value })),
      },
    ],
    ...(signer ? { ca: { key: signer.key, cert: signer.cert } } : {}),
  })
  return { key: pems.private, cert: pems.cert }
}

export { DAY }
