import type { ResolvedAddress, Resolver } from '@/lib/scanner/dns'

type Answer = string[] | Error | (() => Promise<ResolvedAddress[]>)

/**
 * In-memory resolver for tests (`03` §9). Each hostname maps to a list of answers used in
 * order; the last answer repeats. Every call is recorded so tests can assert how many
 * resolutions happened (DNS-rebinding test, SC-13).
 */
export class MockResolver implements Resolver {
  readonly calls: string[] = []
  private readonly answers = new Map<string, Answer[]>()

  /** Registers one or more successive answers for a hostname. */
  set(hostname: string, ...answers: Answer[]): this {
    this.answers.set(hostname, answers)
    return this
  }

  callsFor(hostname: string): number {
    return this.calls.filter((h) => h === hostname).length
  }

  resolve(hostname: string): Promise<ResolvedAddress[]> {
    const attempt = this.calls.filter((h) => h === hostname).length
    this.calls.push(hostname)
    const list = this.answers.get(hostname)
    if (list === undefined || list.length === 0) {
      return Promise.reject(Object.assign(new Error('not found'), { code: 'ENOTFOUND' }))
    }
    const answer = list[Math.min(attempt, list.length - 1)]
    if (answer instanceof Error) return Promise.reject(answer)
    if (typeof answer === 'function') return answer()
    return Promise.resolve(
      (answer ?? []).map((address) => ({ address, family: address.includes(':') ? 6 : 4 })),
    )
  }
}
