import { describe, expect, it } from 'vitest'

import * as route from '@/app/api/scan/route'

describe('app/api/scan/route.ts', () => {
  it('runs on the Node.js runtime and is always dynamic (02 §1)', () => {
    expect(route.runtime).toBe('nodejs')
    expect(route.dynamic).toBe('force-dynamic')
  })

  it.each([
    ['GET', route.GET],
    ['PUT', route.PUT],
    ['PATCH', route.PATCH],
    ['DELETE', route.DELETE],
    ['OPTIONS', route.OPTIONS],
  ])('%s → 405 Allow: POST', (_method, handler) => {
    const response = handler()
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
  })

  it('POST validates before any network work (INVALID_URL for a reserved name)', async () => {
    const response = await route.POST(
      new Request('http://localhost:3000/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"url":"localhost"}',
      }),
    )
    expect(response.status).toBe(400)
  })
})
