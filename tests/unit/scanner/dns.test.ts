import dns from 'node:dns'

import { describe, expect, it, vi } from 'vitest'

import { DNS_TIMEOUT_MS, resolvePinnedAddress, systemResolver } from '@/lib/scanner/dns'
import { ScanError } from '@/lib/scanner/errors'

import { MockResolver } from '../../helpers/mock-resolver'

const live = () => new AbortController().signal

async function failure(promise: Promise<unknown>): Promise<ScanError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ScanError) return error
    throw error
  }
  throw new Error('expected a ScanError')
}

describe('resolvePinnedAddress', () => {
  it('SC-14 prefers the first IPv4 address', async () => {
    const resolver = new MockResolver().set('a.example.com', [
      '2606:4700::1',
      '93.184.215.14',
      '93.184.215.15',
    ])
    await expect(resolvePinnedAddress('a.example.com', resolver, live())).resolves.toEqual({
      hostname: 'a.example.com',
      address: '93.184.215.14',
      family: 4,
    })
  })

  it('SC-14 falls back to the first IPv6 address', async () => {
    const resolver = new MockResolver().set('v6.example.com', ['2606:4700::1', '2606:4700::2'])
    await expect(resolvePinnedAddress('v6.example.com', resolver, live())).resolves.toEqual({
      hostname: 'v6.example.com',
      address: '2606:4700::1',
      family: 6,
    })
  })

  it('SC-11 blocks when the only address is private', async () => {
    const resolver = new MockResolver().set('evil.example.com', ['10.0.0.5'])
    const error = await failure(resolvePinnedAddress('evil.example.com', resolver, live()))
    expect(error.code).toBe('BLOCKED_TARGET')
  })

  it('SC-11 blocks when ANY address is non-public (mixed answer)', async () => {
    const resolver = new MockResolver().set('mixed.example.com', ['93.184.216.34', '127.0.0.1'])
    const error = await failure(resolvePinnedAddress('mixed.example.com', resolver, live()))
    expect(error.code).toBe('BLOCKED_TARGET')
  })

  it.each([['fd00::1'], ['::ffff:10.0.0.1'], ['not-an-ip']])('SC-11 blocks %s', async (address) => {
    const resolver = new MockResolver().set('x.example.com', [address])
    const error = await failure(resolvePinnedAddress('x.example.com', resolver, live()))
    expect(error.code).toBe('BLOCKED_TARGET')
  })

  it('returns DNS_NOT_FOUND for an empty answer', async () => {
    const resolver = new MockResolver().set('empty.example.com', [])
    const error = await failure(resolvePinnedAddress('empty.example.com', resolver, live()))
    expect(error.code).toBe('DNS_NOT_FOUND')
    expect(error.detail).toBe('NO_ADDRESSES')
  })

  it.each(['ENOTFOUND', 'ENODATA', 'EAI_NONAME', 'EAI_NODATA'])(
    'maps %s to DNS_NOT_FOUND',
    async (code) => {
      const resolver = new MockResolver().set(
        'nx.example.com',
        Object.assign(new Error('x'), { code }),
      )
      const error = await failure(resolvePinnedAddress('nx.example.com', resolver, live()))
      expect(error.code).toBe('DNS_NOT_FOUND')
    },
  )

  it('maps other resolver failures to TARGET_UNREACHABLE without leaking the message', async () => {
    const resolver = new MockResolver().set(
      'servfail.example.com',
      Object.assign(new Error('upstream 10.1.2.3 refused'), { code: 'ESERVFAIL' }),
    )
    const error = await failure(resolvePinnedAddress('servfail.example.com', resolver, live()))
    expect(error.code).toBe('TARGET_UNREACHABLE')
    expect(error.message).not.toContain('10.1.2.3')
  })

  it('maps a non-object rejection to TARGET_UNREACHABLE', async () => {
    // Third-party resolvers may reject with a bare string; it must still fail closed.
    const notAnError = JSON.parse('"boom"') as Error
    const resolver = new MockResolver().set('weird.example.com', () => Promise.reject(notAnError))
    const error = await failure(resolvePinnedAddress('weird.example.com', resolver, live()))
    expect(error.code).toBe('TARGET_UNREACHABLE')
  })

  it('passes a ScanError from the resolver through unchanged', async () => {
    const original = new ScanError('BLOCKED_TARGET', 'NON_PUBLIC_ADDRESS')
    const resolver = new MockResolver().set('custom.example.com', () => Promise.reject(original))
    await expect(resolvePinnedAddress('custom.example.com', resolver, live())).rejects.toBe(
      original,
    )
  })

  it('SC-10 times out after the DNS timeout', async () => {
    vi.useFakeTimers()
    try {
      const resolver = new MockResolver().set(
        'slow.example.com',
        () => new Promise(() => undefined),
      )
      const pending = failure(resolvePinnedAddress('slow.example.com', resolver, live()))
      await vi.advanceTimersByTimeAsync(DNS_TIMEOUT_MS)
      const error = await pending
      expect(error.code).toBe('TARGET_TIMEOUT')
      expect(error.detail).toBe('DNS_TIMEOUT')
    } finally {
      vi.useRealTimers()
    }
  })

  it('SC-18 aborts when the scan budget signal fires', async () => {
    const controller = new AbortController()
    const resolver = new MockResolver().set('slow.example.com', () => new Promise(() => undefined))
    const pending = failure(resolvePinnedAddress('slow.example.com', resolver, controller.signal))
    controller.abort()
    const error = await pending
    expect(error.code).toBe('TARGET_TIMEOUT')
    expect(error.detail).toBe('BUDGET_EXCEEDED')
  })

  it('SC-18 does not resolve at all when the budget is already spent', async () => {
    const controller = new AbortController()
    controller.abort()
    const resolver = new MockResolver().set('a.example.com', ['93.184.215.14'])
    const error = await failure(resolvePinnedAddress('a.example.com', resolver, controller.signal))
    expect(error.detail).toBe('BUDGET_EXCEEDED')
    expect(resolver.calls).toEqual([])
  })

  it('ignores a late answer after the timeout fired', async () => {
    vi.useFakeTimers()
    try {
      let answer: (value: { address: string; family: number }[]) => void = () => undefined
      const resolver = new MockResolver().set(
        'late.example.com',
        () =>
          new Promise((resolve) => {
            answer = resolve
          }),
      )
      const pending = failure(resolvePinnedAddress('late.example.com', resolver, live(), 50))
      await vi.advanceTimersByTimeAsync(50)
      answer([{ address: '93.184.215.14', family: 4 }])
      expect((await pending).detail).toBe('DNS_TIMEOUT')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('systemResolver (SC-10)', () => {
  it('calls dns.promises.lookup with all: true and verbatim order', async () => {
    const spy = vi.spyOn(dns.promises, 'lookup')
    const records = await systemResolver.resolve('localhost')
    expect(spy).toHaveBeenCalledWith('localhost', { all: true, order: 'verbatim' })
    expect(records.length).toBeGreaterThan(0)
    for (const record of records) {
      expect(['127.0.0.1', '::1']).toContain(record.address)
      expect([4, 6]).toContain(record.family)
    }
  })
})
