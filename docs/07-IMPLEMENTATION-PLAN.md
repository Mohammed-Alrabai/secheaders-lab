# 07 — Implementation Plan

Seven phases. **Stop at every gate** and post a Phase Report (`CLAUDE.md` §10). Estimated effort assumes focused sessions.

| Phase | Name | Est. | Gate focus |
|---|---|---|---|
| 0 | Environment & scaffold | 0.5 d | Tooling, strict config, CI skeleton |
| 1 | Secure fetch layer (SSRF) | 2–3 d | **Security review** of policies + full SSRF matrix green |
| 2 | Checks & scoring engine | 2–3 d | Spec fidelity: every rule branch + worked examples |
| 3 | API endpoint | 1 d | Contract, errors, rate limiting |
| 4 | UI & i18n | 3 d | UX review + **Arabic copy review by user** |
| 5 | Report, self-hardening, E2E | 1–2 d | Site grades A+ on itself, a11y, Lighthouse |
| 6 | Docs, repo & deploy | 1 d | User approves push + Netlify deploy, launch |

---

## Phase 0 — Environment & scaffold

**Tasks**
- 0.1 Verify `node -v` (22.x), `corepack`, `pnpm -v`, `git --version`. Report; if missing, **ask** before installing.
- 0.2 `git init`, `.gitignore`, `.editorconfig`, `.nvmrc` (22), MIT `LICENSE` (author: Mohammed Alrabai), `AGENTS.md` pointer to `CLAUDE.md`.
- 0.3 Scaffold with the shadcn command in `08-DESIGN-SYSTEM.md` §1 (Next.js App Router, TypeScript, Tailwind v4, shadcn preset, RTL; **no `--monorepo`**). Ensure `src/` dir, ESLint, no Turbopack-only assumptions. Scaffold **into the current folder** without overwriting `CLAUDE.md`, `AGENTS.md`, `KICKOFF-PROMPT.md`, `docs/`, `PROGRESS.md`. `create-next-app` may refuse a non-empty folder: if so, scaffold into a temporary subfolder inside this project (e.g. `.scaffold-tmp`), move the generated files up, then remove the temporary folder. Pin exact versions.
- 0.3b Verify `globals.css` tokens match `08` §2 exactly; add the extended tokens from `08` §4; set up the four fonts (`08` §3); move `assets/brand/*.svg` to `public/brand/` and `favicon.svg` to `src/app/icon.svg`.
- 0.4 Strict `tsconfig` (05 §1), ESLint flat config + Prettier (05 §2), npm scripts (05 §7).
- 0.5 Vitest + coverage config with thresholds; network-guard setup file; one sample test.
- 0.6 Playwright config + one smoke test (home renders).
- 0.7 `next-intl` routing skeleton (`/en`, `/ar`, RTL `dir`), empty message files with parity test.
- 0.8 `src/lib/env.ts` (zod) + `.env.example`.
- 0.9 GitHub Actions `ci.yml`, `codeql.yml`, `dependabot.yml` (not pushed yet).
- 0.10 `poweredByHeader: false`, baseline security headers (final CSP comes in Phase 5).

**Acceptance**
- `pnpm check` green; `/en` and `/ar` render placeholder pages with correct `lang`/`dir`.
- Folder tree matches `02-ARCHITECTURE.md` §3 (empty modules allowed).

---

## Phase 1 — Secure fetch layer

**Tasks**
- 1.1 `errors.ts`: `ScanError` with codes from `02` §4.
- 1.2 `url-policy.ts`: SC-01…SC-09 → `normalizeAndValidate(input): URL`.
- 1.3 `ip-policy.ts`: SC-11, SC-12 → `assertPublicAddress(addr)` incl. IPv4-mapped IPv6 unwrap.
- 1.4 `dns.ts`: injectable `Resolver` interface, default uses `dns.promises.lookup({all:true, verbatim:true})` with 2 s timeout (SC-10, SC-14).
- 1.5 `safe-fetch.ts`: undici `Agent` with pinned lookup (SC-13), manual redirects ≤ 5 with full re-validation (SC-17), timeouts + shared `AbortSignal` (SC-18), body discard (SC-19), header limits (SC-20), fixed request headers (SC-16), no cookies (SC-22). Returns `{ chain, finalUrl, status, headers: [name, value][] }`.
- 1.6 `tls-inspect.ts`: `tls.connect` to pinned IP with `servername`, collect protocol, `authorized`, `authorizationError`, cert `valid_from/valid_to/issuer/subjectaltname`, hostname check via `tls.checkServerIdentity`; 3 s timeout; destroy socket (SC-21).
- 1.7 Test infrastructure: local HTTP + HTTPS servers (self-signed via `selfsigned`), mock resolver, redirect helpers.
- 1.8 Implement **all 24 cases** of the SSRF matrix (`03` §9) + unit tests for every range in SC-12.

**Acceptance**
- All SSRF matrix tests pass; coverage ≥ 95% on these modules.
- Phase Report includes a short **threat model** table: threat → control → test name.
- **Gate:** user (security reviewer) approves.

---

## Phase 2 — Checks & scoring engine

**Tasks**
- 2.1 `types.ts`, `rules.ts` registry (RuleId, category, references — verified URLs only).
- 2.2 `header-utils.ts`: case-insensitive multi-map; parsers for HSTS directives, CSP (directives → source lists; nonce/hash detection), `Set-Cookie` attributes (name + attributes only, values discarded), Referrer-Policy (last valid token wins, per spec).
- 2.3 Check modules in `checks/` — one per group, pure functions, each returning `Finding[]` with `messageKey` + `params`.
- 2.4 `scoring.ts`: deductions with per-rule caps, grade thresholds, A+ requirements, grade caps, `capsApplied`. Export `SCORING_VERSION = 1`.
- 2.5 `index.ts` `scan(input, deps)`: orchestrates policy → DNS → fetch(https) → TLS inspect → http→https check → checks → scoring; total budget; returns `ScanResult`.
- 2.6 `remediation/`: snippet generator per RuleId × Platform (`nginx | apache | iis | nextjs | netlify | cloudflare`). Snippets are recommended secure baselines, with comments noting what to adapt (e.g. CSP must be tailored). Snapshot tests.
- 2.7 Tests: every row in `04` §4 has a test; worked examples `04` §6 as named tests.

**Acceptance**
- Spec-to-test traceability table in the Phase Report (rule row → test name).
- Coverage ≥ 95% on `src/lib/scanner/**`.

---

## Phase 3 — API endpoint

**Tasks**
- 3.1 `schemas.ts`: zod `ScanRequest` (strict) and `ScanResult`.
- 3.2 `app/api/scan/route.ts`: `runtime='nodejs'`, `dynamic='force-dynamic'`, POST only, content-type + size checks, Origin check (SC-23, SC-25), error mapping (SC-26), `no-store` (SC-27), output validation (SC-28), 405 for other methods.
- 3.3 `rate-limit.ts`: in-memory token bucket (defense-in-depth) + document the Netlify platform rule to configure at deploy (SC-24). Verify current Netlify docs and write ADR.
- 3.4 `logger.ts` respecting SC-37.
- 3.5 Integration tests for each status code path against local target servers.

**Acceptance**
- Contract tests prove every error code and the success schema.
- Manual check documented: `curl` examples in the Phase Report (commands without inline comments).

---

## Phase 4 — UI & i18n

**Tasks**
- 4.1 Layout, theme (server-resolved cookie), fonts, header/footer, language switch.
- 4.2 Home page + `ScanForm` (client validation mirrors SC-01…SC-08 messages; server remains authoritative).
- 4.3 Results page: summary, caps notice, grouped findings, `FindingCard`, `FixTabs` (ARIA tabs), `CodeBlock` with copy, TLS panel, redirect chain, raw headers. Sanitization helper for SC-29…SC-31.
- 4.4 All error and loading states.
- 4.5 About/methodology page generated from `rules.ts` + messages.
- 4.6 Complete `en.json` and `ar.json` copy for every rule (title, why, each state).
- 4.7 Component tests where logic exists (sanitizer, tabs keyboard behaviour).

**Acceptance**
- Works fully in EN and AR, light and dark, 360 px → 1440 px.
- No physical-direction Tailwind classes in components.
- **Gate:** user reviews the UI and **all Arabic copy**; apply feedback before Phase 5.

---

## Phase 5 — Report, self-hardening, E2E

**Tasks**
- 5.1 Print stylesheet + "Print / Save as PDF" (platform choice persists into print).
- 5.2 Final security headers + nonce-based CSP via middleware (`03` §6). Verify no inline script/style violations in the browser console. shadcn/Radix render inline `style` attributes; handled by ADR-009 (approved: `style-src-attr 'unsafe-inline'` only).
- 5.2b Contrast test for all token pairings (`08` §4) and the Open Graph image (`08` §9).
- 5.3 Playwright suites: happy path (mocked API), each error state, language switch preserving query, RTL layout, print emulation, keyboard-only flow, axe (both locales/themes).
- 5.4 Run SecHeaders Lab against a **production build served locally over HTTPS** (or deploy preview in Phase 6) — header set must satisfy every A+ requirement; add a unit test that runs the checks against the app's own configured header set.
- 5.5 Lighthouse (local, production build): targets in PRD NFR-01. Record scores.

**Acceptance**
- Own header set scores 100 / A+ in a unit test; e2e + axe green; Lighthouse ≥ 95 ×4.

---

## Phase 6 — Docs, repository & deploy (each step needs explicit approval)

**Tasks**
- 6.1 README, SECURITY.md (user provides contact email), CHANGELOG, screenshots (EN + AR, light + dark) using `example.com` or the app itself as the scanned target.
- 6.2 *Approval:* create public GitHub repo `secheaders-lab`, push, enable branch protection, confirm CI green.
- 6.3 *Approval:* connect Netlify, set env vars, configure platform rate limit, deploy; verify function timeout fits the scan budget.
- 6.4 Post-deploy verification: scan the live site with itself (A+), Mozilla Observatory, smoke tests on `example.com`.
- 6.5 Tag `v1.0.0`, release notes.
- 6.6 Hand the user: LinkedIn **Projects** entry text, **Featured** link text, and a launch post draft (EN, optional AR) — user posts it themselves.

**Acceptance**
- Live URL works; README complete; v1.0.0 released.
