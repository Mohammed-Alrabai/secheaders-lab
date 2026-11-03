import { z } from 'zod'

const DEV_SITE_URL = 'http://localhost:3000'

const httpUrl = z.url({ protocol: /^https?$/ }).transform((value) => new URL(value).origin)

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_SITE_URL: httpUrl.optional(),
  SCAN_TOTAL_BUDGET_MS: z.coerce.number().int().min(1_000).max(20_000).default(8_000),
  SCAN_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(1).max(100).default(10),
})

export interface Env {
  nodeEnv: 'development' | 'test' | 'production'
  /** Origin only (no path); used for the same-origin check (SC-25) and absolute URLs. */
  siteUrl: string
  scanTotalBudgetMs: number
  scanRateLimitPerMin: number
}

export class EnvError extends Error {
  constructor(issues: string[]) {
    super(`Invalid environment configuration: ${issues.join('; ')}`)
    this.name = 'EnvError'
  }
}

/**
 * Parses and validates environment variables. Values are never echoed in errors,
 * only the variable names and the reason.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    throw new EnvError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    )
  }
  const data = result.data
  if (data.NODE_ENV === 'production' && data.NEXT_PUBLIC_SITE_URL === undefined) {
    throw new EnvError(['NEXT_PUBLIC_SITE_URL: required in production'])
  }
  return {
    nodeEnv: data.NODE_ENV,
    siteUrl: data.NEXT_PUBLIC_SITE_URL ?? DEV_SITE_URL,
    scanTotalBudgetMs: data.SCAN_TOTAL_BUDGET_MS,
    scanRateLimitPerMin: data.SCAN_RATE_LIMIT_PER_MIN,
  }
}

let cached: Env | undefined

/** Validated environment for the current process (parsed once, on first use). */
export function getEnv(): Env {
  cached ??= parseEnv(process.env)
  return cached
}
