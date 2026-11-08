// Writes the test counts and coverage of a CI run to the GitHub job summary (ADR-042).
// Reads only local report files produced earlier in the same job; makes no network calls.
// Usage (CI): node scripts/ci-summary.mjs >> "$GITHUB_STEP_SUMMARY"

import { readFileSync } from 'node:fs'

/** Parsed JSON, or null when the file is missing or unreadable (a step failed or was skipped). */
function readJson(read) {
  try {
    return JSON.parse(read())
  } catch {
    return null
  }
}

const vitest = readJson(() => readFileSync('reports/vitest.json', 'utf8'))
const e2e = readJson(() => readFileSync('reports/e2e.json', 'utf8'))
const coverage = readJson(() => readFileSync('coverage/coverage-summary.json', 'utf8'))

const notRun = 'not run'
const percent = (metric) => (metric ? `${metric.pct.toFixed(2)}%` : notRun)
const icon = (ok) => (ok ? '✅' : '❌')

const lines = ['## Test summary', '', '| Suite | Result |', '|---|---|']

if (vitest) {
  const ok = vitest.numFailedTests === 0 && vitest.success !== false
  lines.push(
    `| Unit and integration | ${icon(ok)} ${vitest.numPassedTests} passed, ` +
      `${vitest.numFailedTests} failed (${vitest.numTotalTests} total) |`,
  )
} else {
  lines.push(`| Unit and integration | ${notRun} |`)
}

if (e2e) {
  const { expected, unexpected, flaky, skipped } = e2e.stats
  lines.push(
    `| End-to-end (Playwright) | ${icon(unexpected === 0)} ${expected} passed, ` +
      `${unexpected} failed, ${flaky} flaky, ${skipped} skipped |`,
  )
} else {
  lines.push(`| End-to-end (Playwright) | ${notRun} |`)
}

const total = coverage?.total
lines.push(
  '',
  '### Coverage (`src/lib`)',
  '',
  '| Statements | Branches | Functions | Lines |',
  '|---|---|---|---|',
  `| ${percent(total?.statements)} | ${percent(total?.branches)} | ` +
    `${percent(total?.functions)} | ${percent(total?.lines)} |`,
  '',
  `Node ${process.version} · commit \`${(process.env.GITHUB_SHA ?? 'local').slice(0, 7)}\``,
  '',
)

process.stdout.write(lines.join('\n'))
