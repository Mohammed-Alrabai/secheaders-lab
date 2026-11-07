# Progress Tracker

> Updated by the agent after every task. Newest entries at the top of the log.

## Current status

| Field | Value |
|---|---|
| Current phase | Phase 6 — Docs, repository & deploy (in progress) |
| Last gate approved | Phase 5, approved by user 2026-11-07 |
| Blockers | none |

## Phase checklist

- [x] Phase 0 — Environment & scaffold (approved 2026-11-03)
- [x] Phase 1 — Secure fetch layer (SSRF) — **security gate** (approved 2026-11-07)
- [x] Phase 2 — Checks & scoring engine (approved 2026-11-07)
- [x] Phase 3 — API endpoint (approved 2026-11-07)
- [x] Phase 4 — UI & i18n — **Arabic copy review gate** (approved 2026-11-07)
- [x] Phase 5 — Report, self-hardening, E2E (approved 2026-11-07)
- [ ] Phase 6 — Docs, repository & deploy — **approval per step**

## Open TODOs

| ID | Item | Owner |
|---|---|---|
| ~~T-1~~ | ~~SECURITY.md contact~~ — user chose GitHub private vulnerability reporting only (no public email) | Done |
| T-21 | Enable GitHub private vulnerability reporting when the repository is created (SECURITY.md links to it) | Agent (6.2, needs approval) |
| T-22 | Add the live demo link and CI badge to README after deploy | Agent (6.4) |
| T-2 | Provide LinkedIn profile URL for footer | User (Phase 6) — `https://www.linkedin.com/in/mohammed-alrabai` |
| T-3 | Netlify docs verified 2026-11-07 (ADR-024): 60 s sync limit, code-based rate limits on all plans (2 rules on free). Still to do at deploy: add the `netlify.toml` redirect rate-limit rule and confirm it blocks the 11th request/min on `/api/scan` | Agent (Phase 6) |
| ~~T-4~~ | ~~Scoring spec gaps~~ — resolved 2026-11-07 (ADR-020…023) | Done |
| ~~T-5~~ | ~~Remove obsolete `interest-cohort=()`~~ — approved and done (ADR-029) | Done |
| T-6 | SC-25 Origin check vs Netlify deploy-preview origins | Agent (Phase 3) |
| ~~T-7~~ | ~~Runtime `<style>` injection under nonce CSP~~ — none from Base UI; 0 violations (ADR-030) | Done |
| T-8 | Add explicit tests + denylist for 6to4, Teredo, `64:ff9b:1::/48` (strengthens SC-12) | Agent (Phase 1) |
| T-9 | Dev-only advisories: `deepmerge` (low, via shadcn CLI) and `minimatch` (moderate, via typescript-eslint); re-check on each Dependabot run | Agent (ongoing) |
| T-10 | Confirm Dependabot handles the pnpm 12 lockfile once the repo is on GitHub | Agent (Phase 6) |
| ~~T-11~~ | ~~latin1 header bytes / bidi stripping in the UI~~ — done in `sanitize.ts` + e2e SSRF case 22 (Phase 4) | Done |
| ~~T-12~~ | ~~rawHeaders truncation + cookie redaction~~ — done in `scan()` (Phase 2) | Done |
| ~~T-13~~ | ~~ADR-013 HTTPS → HTTP fallback~~ — done in `scan()` (Phase 2) | Done |
| ~~T-14~~ | ~~i18n copy for every message key~~ — done; `message-coverage.test.ts` enforces it | Done |
| T-15 | The http→https check treats a connect failure on any http hop as "port 80 not served" (pass); only the first hop is expected to fail that way in practice | Agent (note) |
| ~~T-16~~ | ~~platform 429 without `Retry-After`~~ — handled (status fallback) + e2e | Done |
| T-17 | Footer GitHub link once the repository exists | Agent (Phase 6) |
| T-18 | Optional: the brand SVGs carry a ~7.7 KB C2PA provenance block each (62% of the file); strip only if the user wants | User |
| ~~T-19~~ | ~~Arabic copy review~~ — approved with Phase 4 | Done |
| ~~T-20~~ | ~~Lighthouse target scope~~ — ADR-034 accepted | Done |

## Justified exceptions (`any`, `eslint-disable`, `@ts-expect-error`)

_none_

## shadcn-installed packages (`05` §6)

`shadcn init --preset b3JA2ZBtnk --template next --rtl --pointer --no-monorepo` (shadcn 4.23.0, style `base-rhea`, Base UI primitives) added:
`@base-ui/react` 1.9.0 · `class-variance-authority` 0.7.1 · `cn` 0.5.2 (shadcn-ui/cn, replaces clsx + tailwind-merge) · `tw-animate-css` 1.4.0 · `shadcn` 4.23.0 (dev; provides `shadcn/tailwind.css`) · `lucide-react`.
Removed: `next-themes` and the generated `theme-provider.tsx` (not approved, `08` §6).

## Log

- 2026-11-07 — 6.1: `README.md` (EN + AR intro, screenshots, features, Mermaid flow, security design, scoring summary, stack, setup, testing, roadmap, disclaimer), `SECURITY.md` (GitHub private vulnerability reporting, scope, testing rules), `CHANGELOG.md` (Keep a Changelog, Unreleased). Screenshots in `docs/screenshots/` captured from one manual scan of `example.com` per locale/theme (allowed by `CLAUDE.md` §6) on the local production build: F / 26. Live demo link and CI badge wait for 6.2–6.4.

- 2026-11-07 — Phase 5 complete (pending approval). Tasks:
  - 5.1 Print / Save as PDF (FR-09): A4, page numbers, print header (product, target, date), failing/warning findings expanded, selected platform's fix only, controls hidden, light palette always (dark tokens screen-only). E2E saves EN/AR PDFs to `test-results/`.
  - 5.2 Nonce CSP per request in `proxy.ts` (ADR-030), final own headers from `03` §6; `interest-cohort` removed (ADR-029, approved). API and `/brand` get locked-down CSPs.
  - 5.2b Contrast test for every `08` §4 pairing in both themes (`--link` token, ADR-031); OG images EN/AR rendered by the browser (ADR-032); canonical + hreflang per page, `robots.txt`, `sitemap.xml`.
  - 5.3 E2E: axe WCAG 2.2 AA on 5 pages × 2 locales × 2 themes, keyboard-only flow, CSP violations + DevTools CSP issues, print.
  - 5.4 The headers our production server actually sends score 100 / A+ (e2e) and the configured set scores 100 / A+ (unit).
  - 5.5 Lighthouse 13.6.0 (`pnpm dlx`, approved; Chrome headless, mobile profile, local production build). Perf / A11y / BP / SEO: `/en` 100/100/100/100, `/ar` 100/100/100/100, `/en/about` 100/100/100/100, `/ar/about` 98/100/100/100, `/en/scan?url=example.com` 89/100/100/66 (live scan LCP 3.7 s; `noindex` by design) — ADR-034 accepted.
  - Gate: lint, typecheck, build ✅; 1173 unit/integration tests ✅ (99.8% statements, 98.9% branches); 46 e2e ✅ (Edge).
  - Bugs caught: print override lost to preflight's `!important [hidden]` (early cascade layer); dark palette leaking into print; dark `--primary` text at 2.6:1; destructive alert text contrast; scroll regions not keyboard-reachable; unknown paths lost `lang`/`dir` (localized catch-all); `/about` canonicalized to home; Zod's eval probe logged a CSP issue (ADR-033, test now catches DevTools CSP issues).

- 2026-11-07 — Phase 4 complete (pending the user's UI + Arabic review). shadcn components added: input, label, card, badge, tabs, collapsible, separator, skeleton, alert, dropdown-menu, table (no new packages; Base UI already present); `sonner`, `tooltip`, `progress`, `scroll-area` not installed (ADR-027). Layout + server-resolved theme (ADR-026), header/footer/skip link/language switch, home + `ScanForm` (client check proven to agree with the server policy), results page (`ScanRunner`, `ScanReport`, `FindingCard`, `FixTabs`, `CodeBlock`, `CopyButton`), loading/error states, methodology page rendered from `rules.ts`/`scoring.ts`, full EN/AR copy, `sanitize.ts` (SC-29…31, T-11). Tests: 1119 unit/integration ✅, 21 e2e ✅ (twice, Edge); lint, typecheck, build ✅; no horizontal overflow at 360 px on any page in either language. Notes:
  - Bugs caught: Arabic «−20 نقطة» rendered as «20- نقطة» in RTL → rephrased «خصم 20 نقطة»; e2e load timeouts with 6 workers → 3 workers.
  - Tool quirk: `\u` escapes in written files became literal bidi characters; replaced with numeric code points and a repo scan confirms no literal control/bidi/BOM characters.
  - Our own `X-Frame-Options: DENY` blocks same-origin framing (observed during testing), as intended.

- 2026-11-07 — Phase 3 complete. `schemas.ts` (strict request; strict `ScanResult` checked against the TS type via `satisfies`), `limits.ts` (dependency-free, client-safe), `logger.ts` (SC-37 fields only), `rate-limit.ts` (token bucket + best-effort client key), `api/scan-handler.ts` + `app/api/scan/route.ts` (Node runtime, force-dynamic, 405 for other methods), `version.ts`. ADR-024, ADR-025. 710 tests ✅, `src/lib/**` 100% lines / 98.7% branches; lint, typecheck, build ✅. Manual curl on the local production build: 405/415/403/413/400/429 as specified; one manual smoke scan of `example.com` (allowed by `CLAUDE.md` §6) returned F/26 in 1.4 s. Notes:
  - Bug caught by a contract test: the handler forwarded policy-invalid URLs to the scanner; it now validates SC-01…SC-09 itself before any scan work.
  - Malformed JSON / schema failures map to `INVALID_URL` (400), the only 400 code in `02` §4.

- 2026-11-07 — Phase 2 complete. T-4 resolved with the user (ADR-020…023); `tldts` 7.4.19 added (approved). Delivered `types.ts`, `rules.ts` (21 MDN/OWASP URLs verified to load; ASVS IDs left as `TODO(verify-ref)`), `header-utils.ts`, `checks/*`, `scoring.ts` (`SCORING_VERSION = 1`), `scan()` in `index.ts`, `remediation/`. 647 tests ✅; `src/lib/**` 100% lines, 98.7% branches; lint, typecheck, build ✅. Notes:
  - Bug caught by tests: `tldts` ignores the PSL private section by default (`a.github.io` ≡ `b.github.io`); fixed with `allowPrivateDomains: true`.
  - Contract additions in `02` §4: `ScanResult.scoringVersion`, `Finding.notes`. Pass/info findings carry `severity: 'info'`.
  - `safeFetch` gained `stopBefore` so the http→https check validates but never requests the https target.
  - Header rule checks are grouped in `checks/headers.ts` instead of one file each.
  - `security/detect-object-injection`: registry and remediation lookups use `Map`s instead of disabling the rule.

- 2026-11-03 — Phase 1 complete. Added `undici` 8.12.3, `ipaddr.js` 2.5.0, `selfsigned` 5.5.0 (dev) from the approved list. Modules: `errors.ts` (1.1), `url-policy.ts` (1.2), `ip-policy.ts` (1.3), `dns.ts` (1.4), `safe-fetch.ts` (1.5), `tls-inspect.ts` (1.6), test helpers (1.7), SSRF matrix 24/24 + extra cases (1.8). 383 tests ✅; `src/lib/scanner/**` 100% lines / 100% branches; lint, typecheck, build ✅. ADR-018, ADR-019. Notes:
  - SC-10: Node 24 deprecates `verbatim: true`; the identical `order: 'verbatim'` is used.
  - SC-01 stricter: all percent-encoded `%00–%1F` and `%7F` are rejected, not only CR/LF.
  - SC-07 stricter: labels must be LDH (+ `_`), 1–63 chars, no leading/trailing hyphen.
  - SC-12 + T-8 stronger: IPv6 must be inside `2000::/3`; explicit deny lists back up ipaddr.js (6to4, Teredo, NAT64 incl. `64:ff9b:1::/48`, IPv4-compatible `::/96`, ORCHID, `3fff::/20`).
  - SC-13: the connector dials the validated IP as `hostname` with the real name as TLS `servername`; no DNS happens at socket level. Verified by spying on `tls.connect` / `net.connect` in the production path.
  - Network guard caught one test trying to TLS-inspect a public IP before it connected; test corrected to dial the local server.

- 2026-11-03 — 0.6 (closed): Chromium download stalled > 20 min and was stopped. Added optional local `PLAYWRIGHT_CHANNEL` (`msedge` / `chrome`) to reuse an installed browser; ignored in CI, which keeps the bundled Chromium. E2E 6/6 ✅ with Edge (redirect `/`→`/en`, `lang`/`dir` for en/ar, 404 for `/fr`, security headers + no `X-Powered-By`, no cookies). Local run: `$env:PLAYWRIGHT_CHANNEL='msedge'` then `corepack pnpm test:e2e`.

- 2026-11-03 — 0.9: `.github/workflows/ci.yml` (verify: frozen install → lint → typecheck → coverage → build → Playwright e2e → `pnpm audit --audit-level=high`; Gitleaks; Semgrep container 1.183.0 with `p/owasp-top-ten`, `p/typescript`, `p/nextjs`, `p/secrets`, ERROR severity blocks), `codeql.yml` (javascript-typescript, security-extended, weekly + PR, job-level `security-events: write`), `.github/dependabot.yml` (npm + actions weekly, minor/patch grouped, majors ignored per `CLAUDE.md` §5). All actions pinned to commit SHAs resolved with `git ls-remote` (user approved; codeql-action tag is annotated → peeled commit used). YAML validated with Prettier; not pushed. Local `pnpm audit`: 0 high/critical; 1 low (`deepmerge` via `shadcn` CLI, no patch) and 1 moderate (`minimatch` <11.0.1 via `typescript-eslint`) — both dev-only tooling, tracked as T-9.

- 2026-11-03 — 0.10: `poweredByHeader: false`; own headers from `03` §6 defined once in `src/lib/security-headers.ts` and applied by `next.config.ts` to every path (no `netlify.toml` duplicate). Baseline CSP limited to `object-src`/`base-uri`/`form-action`/`frame-ancestors`/`upgrade-insecure-requests`; nonce CSP in Phase 5. Unit tests + e2e header assertion. 54 tests ✅, build ✅.

- 2026-11-03 — 0.8: `src/lib/env.ts` (zod): `NEXT_PUBLIC_SITE_URL` (http/https only, normalized to origin, required in production), `SCAN_TOTAL_BUDGET_MS` 1000–20000 (default 8000), `SCAN_RATE_LIMIT_PER_MIN` 1–100 (default 10); errors never echo values. `.env.example` committed. 45 tests ✅, `src/lib` coverage 100%.

- 2026-11-03 — 0.7: next-intl routing (`/en`, `/ar`, prefix always, `localeCookie: false` per ADR-017) via `src/proxy.ts`; `[locale]` root layout sets `lang`/`dir` and per-locale font variables; placeholder home + localized 404. Request config uses `next/root-params` (next-intl 4.14 deprecates `requestLocale`/`setRequestLocale`); `typecheck` now runs `next typegen` first. Message parity test (keys + ICU placeholders + non-empty). 29 unit tests ✅, build ✅ (`/[locale]` dynamic, ADR-014). E2E smoke written; run pending Chromium download.
- 2026-11-03 — 0.6: `playwright.config.ts` (Chromium, `next start` on :3100, traces on failure) + smoke spec. Chromium download from `cdn.playwright.dev` failed twice (ECONNRESET, then ENOTFOUND); retry running.

- 2026-11-03 — 0.5: `vitest.config.ts` (node env, coverage v8 on `src/lib/**`, thresholds: overall 85% lines, `src/lib/scanner/**` 95% lines+branches). `tests/setup/network-guard.ts` fails closed: throws on non-loopback IP-literal sockets, wraps injected `lookup` functions so they must resolve to loopback (handles Node's `all: true` form), blocks real DNS except `localhost`. 18 guard tests + 2 sample tests pass. **Incident:** the first guard draft missed `net.connect()`'s normalized `[[options, cb]]` argument shape, so two guard tests made real outbound connection attempts (to `93.184.215.14:80` and `1.1.1.1:443`, no data sent) before the fix; the guard now has tests for both call shapes.

- 2026-11-03 — 0.4: Strict `tsconfig` (`05` §1 flags + `noImplicitReturns`, target ES2022). ESLint flat config: next core-web-vitals + next/typescript + `typescript-eslint` strict/stylistic type-checked + `eslint-plugin-security`, `no-console`, `no-non-null-assertion`, and a `no-restricted-syntax` rule blocking physical-direction Tailwind classes in `src/app`/`src/components` (verified with a probe file). Prettier: 100 cols, single quotes, trailing commas, no semicolons (kept from shadcn output so generated components stay close to upstream); hand-written Markdown excluded. lint ✅ typecheck ✅.

- 2026-11-03 — 0.3b: Preset tokens verified programmatically against `08` §2 (exact match). Added `08` §4 tokens + `@theme inline` mappings, font roles per `:lang()`, `src/app/fonts.ts` (Oxanium, JetBrains Mono; IBM Plex Sans Arabic + Changa with `preload: false`). Brand SVGs moved to `public/brand/`, `favicon.svg` copied to `src/app/icon.svg`, `assets/` removed. `pnpm build` ✅.

- 2026-11-03 — 0.3: Scaffolded via `.scaffold-tmp`, moved into `src/` layout (app, components, hooks, lib); generated CLAUDE.md/AGENTS.md/README/favicon.ico discarded. All versions exact-pinned. pnpm 12 minimum-release-age policy flagged tailwindcss/@tailwindcss/postcss 4.3.4 and lucide-react 1.67.0 as too fresh → pinned 4.3.3 / 1.66.0 instead of adding exclusions. Build scripts denied for `@swc/core`, `@parcel/watcher` (prebuilt binaries). Confirmed in bundled Next 16.4 docs: `middleware.ts` is deprecated → `proxy.ts`. `pnpm build` ✅.

- 2026-11-03 — 0.2: `git init` (main), `.gitignore`, `.editorconfig`, `.nvmrc` (24), MIT `LICENSE`. Moved `KICKOFF-PROMPT.md` → `docs/`, `logo-preview.png` → `docs/brand/`. ADR-009 marked Accepted; ADR-010…017 added. Commits use the global git identity (user choice) with a Claude co-author trailer.
- 2026-11-03 — 0.1: Node v24.21.0, Corepack 0.36.0, git 2.52.0; pnpm not on PATH → run via `corepack pnpm` (ADR-011). Latest stable at start: next 16.4.4, pnpm 12.16.1, shadcn 4.23.0, next-intl 4.14.9, tailwindcss 4.3.4; TypeScript pinned 6.0.x and ESLint 9.39.x (ADR-012).

- 2026-11-03 — Design system added: docs/08-DESIGN-SYSTEM.md, logo files in assets/brand/, ADR-006…009 (ADR-009 approved by user).
- 2026-11-03 — Planning package created (CLAUDE.md + docs 01–07). Awaiting agent kickoff.
