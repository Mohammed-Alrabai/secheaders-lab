// Daily self-scan of the project's own live site (ADR-048). It scans ONLY `SITE` below,
// through the public API exactly as a visitor would, and keeps one GitHub issue in sync:
// opened (or commented on) when the site drops below A+ / 100, closed when it recovers.
//
// Usage (CI):   node scripts/self-scan.mjs >> "$GITHUB_STEP_SUMMARY"
// Usage (local): DRY_RUN=1 node scripts/self-scan.mjs   (never touches GitHub issues)
// Exit code: 0 when the site is A+ / 100, 1 otherwise. Markdown goes to stdout, logs to stderr.

import { pathToFileURL } from 'node:url'

export const SITE = 'https://secheaders-lab.netlify.app'
export const HOST = 'secheaders-lab.netlify.app'
export const ISSUE_TITLE = 'Self-scan: the live site is below A+ / 100'

/**
 * @typedef {{ ok: boolean, grade: string | null, score: number | null,
 *   problems: string[], error: string | null }} Evaluation
 */

/**
 * Judges an API response body. Anything that is not a full A+ / 100 result is a failure,
 * including an error body or an unexpected shape.
 * @param {unknown} body
 * @returns {Evaluation}
 */
export function evaluate(body) {
  const fail = (/** @type {string} */ error) => ({
    ok: false,
    grade: null,
    score: null,
    problems: [],
    error,
  })
  if (typeof body !== 'object' || body === null) return fail('No JSON body')
  const record = /** @type {Record<string, unknown>} */ (body)
  if ('error' in record) {
    const inner = /** @type {{ code?: unknown } | null} */ (record.error)
    return fail(`API error: ${typeof inner?.code === 'string' ? inner.code : 'unknown'}`)
  }
  const { grade, score, findings } = record
  if (typeof grade !== 'string' || typeof score !== 'number' || !Array.isArray(findings)) {
    return fail('Unexpected response shape')
  }
  const problems = findings
    .filter((f) => f && (f.status === 'fail' || f.status === 'warn'))
    .map((f) => `${String(f.id)}: ${String(f.status)} (${String(f.deduction)} points)`)
  return { ok: grade === 'A+' && score === 100, grade, score, problems, error: null }
}

/**
 * @param {Evaluation} result
 * @param {string} [runUrl]
 * @returns {string}
 */
export function summaryMarkdown(result, runUrl) {
  const lines = ['## Self-scan', '', `Target: ${SITE}`, '']
  if (result.error) {
    lines.push(`❌ ${result.error}`)
  } else {
    lines.push(
      `${result.ok ? '✅' : '❌'} Grade **${String(result.grade)}**, score **${String(result.score)}/100**`,
    )
    if (result.problems.length > 0) {
      lines.push('', 'Findings that cost points:', '', ...result.problems.map((p) => `- ${p}`))
    }
  }
  if (runUrl) lines.push('', `Run: ${runUrl}`)
  lines.push('')
  return lines.join('\n')
}

/** @param {string} message */
const log = (message) => process.stderr.write(`${message}\n`)

/**
 * Minimal GitHub REST call with the job token.
 * @param {string} path
 * @param {string} [method]
 * @param {unknown} [payload]
 */
async function github(path, method = 'GET', payload) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${process.env.GITHUB_TOKEN ?? ''}`,
      'x-github-api-version': '2022-11-28',
      ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  })
  if (!response.ok) throw new Error(`GitHub API ${method} ${path}: ${String(response.status)}`)
  return response.json()
}

/**
 * Opens, comments on or closes the single self-scan issue.
 * @param {Evaluation} result
 * @param {string} markdown
 */
async function syncIssue(result, markdown) {
  const repo = process.env.GITHUB_REPOSITORY
  if (process.env.DRY_RUN === '1' || !repo || !process.env.GITHUB_TOKEN) {
    log('Dry run: GitHub issues not touched.')
    return
  }
  /** @type {{ number: number, title: string, pull_request?: unknown }[]} */
  const open = await github(`/repos/${repo}/issues?state=open&per_page=100`)
  const existing = open.find((i) => !i.pull_request && i.title === ISSUE_TITLE)
  if (result.ok) {
    if (existing) {
      await github(`/repos/${repo}/issues/${String(existing.number)}/comments`, 'POST', {
        body: `Back to A+ / 100.\n\n${markdown}`,
      })
      await github(`/repos/${repo}/issues/${String(existing.number)}`, 'PATCH', {
        state: 'closed',
        state_reason: 'completed',
      })
      log(`Closed issue #${String(existing.number)}.`)
    }
    return
  }
  if (existing) {
    await github(`/repos/${repo}/issues/${String(existing.number)}/comments`, 'POST', {
      body: markdown,
    })
    log(`Commented on issue #${String(existing.number)}.`)
  } else {
    const created = await github(`/repos/${repo}/issues`, 'POST', {
      title: ISSUE_TITLE,
      body: markdown,
    })
    log(`Opened issue #${String(created.number)}.`)
  }
}

async function main() {
  const runUrl =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined
  /** @type {unknown} */
  let body = null
  try {
    const response = await fetch(`${SITE}/api/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: SITE },
      body: JSON.stringify({ url: HOST }),
      signal: AbortSignal.timeout(30_000),
    })
    body = await response.json()
  } catch (error) {
    log(`Scan request failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  const result = evaluate(body)
  const markdown = summaryMarkdown(result, runUrl)
  process.stdout.write(markdown)
  await syncIssue(result, markdown)
  process.exitCode = result.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    log(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
