# Progress Tracker

> Updated by the agent after every task. Newest entries at the top of the log.

## Current status

| Field | Value |
|---|---|
| Current phase | Phase 1 — complete, awaiting security gate approval |
| Last gate approved | Phase 0, approved by user 2026-11-03 |
| Blockers | none |

## Phase checklist

- [x] Phase 0 — Environment & scaffold (approved 2026-11-03)
- [x] Phase 1 — Secure fetch layer (SSRF) — **security gate** (report posted 2026-11-03, awaiting approval)
- [ ] Phase 2 — Checks & scoring engine
- [ ] Phase 3 — API endpoint
- [ ] Phase 4 — UI & i18n — **Arabic copy review gate**
- [ ] Phase 5 — Report, self-hardening, E2E
- [ ] Phase 6 — Docs, repository & deploy — **approval per step**

## Open TODOs

| ID | Item | Owner |
|---|---|---|
| T-1 | Provide contact email for SECURITY.md | User (Phase 6) |
| T-2 | Provide LinkedIn profile URL for footer | User (Phase 6) — `https://www.linkedin.com/in/mohammed-alrabai` |
| T-3 | Verify Netlify function timeout & rate-limit config (incl. free-tier availability) | Agent (Phase 3/6) |
| T-4 | Spec gaps to resolve with user before Phase 2: PSL for TLS-HTTP-REDIRECT, CSP `strict-dynamic` + multiple-CSP evaluation, HSTS 180d–1y with includeSubDomains, CSP pass without `base-uri`, finding granularity for cookie rules, example 2 cookie `Secure` | User + Agent (Phase 1/2) |
| T-5 | Remove obsolete `interest-cohort=()` from own Permissions-Policy (needs approval, `03` §6) | User (Phase 5) |
| T-6 | SC-25 Origin check vs Netlify deploy-preview origins | Agent (Phase 3) |
| T-7 | Verify `sonner` / Radix runtime `<style>` injection under nonce CSP | Agent (Phase 5) |
| T-8 | Add explicit tests + denylist for 6to4, Teredo, `64:ff9b:1::/48` (strengthens SC-12) | Agent (Phase 1) |
| T-9 | Dev-only advisories: `deepmerge` (low, via shadcn CLI) and `minimatch` (moderate, via typescript-eslint); re-check on each Dependabot run | Agent (ongoing) |
| T-10 | Confirm Dependabot handles the pnpm 12 lockfile once the repo is on GitHub | Agent (Phase 6) |
| T-11 | Header values arrive as latin1-decoded bytes (e.g. U+202E shows as `â\x80®`). The UI sanitizer (SC-31) must decode UTF-8 for display and then strip bidi/control chars; SSRF case 22 UI half is a Phase 4/5 test | Agent (Phase 4) |
| T-12 | SC-20 display truncation (2 KB per value) and `set-cookie` value redaction (ADR-015) happen when building `ScanResult.rawHeaders` | Agent (Phase 2, task 2.5) |
| T-13 | ADR-013 fallback: `safeFetch` reports TLS failures as `TARGET_UNREACHABLE` / `TLS_FAILURE`; `scan()` must catch that detail and retry `http://` | Agent (Phase 2, task 2.5) |

## Justified exceptions (`any`, `eslint-disable`, `@ts-expect-error`)

_none_

## shadcn-installed packages (`05` §6)

`shadcn init --preset b3JA2ZBtnk --template next --rtl --pointer --no-monorepo` (shadcn 4.23.0, style `base-rhea`, Base UI primitives) added:
`@base-ui/react` 1.9.0 · `class-variance-authority` 0.7.1 · `cn` 0.5.2 (shadcn-ui/cn, replaces clsx + tailwind-merge) · `tw-animate-css` 1.4.0 · `shadcn` 4.23.0 (dev; provides `shadcn/tailwind.css`) · `lucide-react`.
Removed: `next-themes` and the generated `theme-provider.tsx` (not approved, `08` §6).

## Log

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
