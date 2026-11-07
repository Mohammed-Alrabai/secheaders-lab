# 05 — Engineering Standards

## 1. TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`.
- No `any`. Use `unknown` + narrowing / zod. No non-null assertions (`!`) in `src/lib/**`.
- Discriminated unions for results and errors; exhaustive `switch` with a `never` check.
- Path alias `@/*` → `src/*`.
- Pure functions in `src/lib/scanner/checks/**`: input = parsed response data, output = `Finding[]`. No I/O inside checks.

## 2. Code style

- ESLint flat config: `eslint-config-next`, `typescript-eslint` (strict-type-checked), `eslint-plugin-security`. `--max-warnings 0`.
- Prettier (+ `prettier-plugin-tailwindcss`). 100-char line width, single quotes, trailing commas.
- File names `kebab-case.ts`; React components `PascalCase.tsx`; one component per file.
- Comments explain **why**, not what. Reference security controls as `// SC-13: pin validated IP to prevent DNS rebinding`.
- No dead code, no commented-out code, no `console.log` (use a tiny `logger` module that respects SC-37).

## 3. Testing

| Layer | Tool | Scope | Coverage threshold |
|---|---|---|---|
| Unit | Vitest | `src/lib/**` (policies, parsers, every rule branch, scoring, examples in scoring spec §6) | **≥ 95% lines/branches for `src/lib/scanner/**`** |
| Integration | Vitest + local `http`/`https` servers (self-signed certs generated in test setup) + injected mock resolver | `safe-fetch`, `tls-inspect`, `scan()` end-to-end, SSRF matrix (`03` §9), API route handler | included in overall |
| E2E | Playwright (Chromium; Firefox in CI optional) + `@axe-core/playwright` | Home → scan (API mocked via route interception) → results, language switch + RTL, print view, error states, a11y | — |
| Overall | | | **≥ 85% lines** |

Rules:
- Tests must not touch the real internet. A global guard in Vitest setup fails any non-loopback socket.
- Test names reference IDs: `it('SC-12 rejects IPv4-mapped loopback ::ffff:127.0.0.1')`, `it('HDR-HSTS warn when max-age < 180d')`.
- Fix-snippet generation: snapshot tests per platform.
- Every bug fix starts with a failing test.

## 4. Git workflow

- Initialize git in Phase 0. Default branch `main`.
- **Conventional Commits**: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`, `ci:`, `security:`. Scope optional: `feat(scanner): …`.
- One logical change per commit. Commit after each completed task.
- Never commit: `.env*` (except `.env.example`), `node_modules`, `.next`, coverage, test certs, `.netlify`.
- No pushing or remote creation without approval (`CLAUDE.md` §5). When approved: GitHub repo `secheaders-lab`, public, MIT license, branch protection on `main` (CI required).

## 5. CI (GitHub Actions)

`ci.yml` on push + PR:
1. Checkout (SHA-pinned actions), setup Node 24 (ADR-010), `corepack enable`, `pnpm install --frozen-lockfile`
2. `pnpm lint` · `pnpm typecheck` · `pnpm test --coverage` · `pnpm build`
3. Playwright e2e (install browsers with cache)
4. `pnpm audit --audit-level=high`
5. Gitleaks
6. Semgrep (`p/owasp-top-ten`, `p/typescript`, `p/nextjs`, `p/secrets`)

`codeql.yml`: weekly + PR, language `javascript-typescript`.
`dependabot.yml`: npm + github-actions, weekly, grouped minor/patch.
Workflow-level `permissions: contents: read`.

## 6. Dependency policy

**Approved list** (anything else needs user approval + ADR):

Runtime: `next`, `react`, `react-dom`, `next-intl`, `zod`, `ipaddr.js`, `undici`, `lucide-react`, `clsx`, `tldts` (ADR-020)
Dev: `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `tailwindcss`, `@tailwindcss/postcss`, `postcss`, `eslint`, `eslint-config-next`, `typescript-eslint`, `eslint-plugin-security`, `prettier`, `prettier-plugin-tailwindcss`, `vitest`, `@vitest/coverage-v8`, `@playwright/test`, `@axe-core/playwright`, `selfsigned` (test certs only)

shadcn/ui: the packages that `shadcn init --preset b3JA2ZBtnk` and `shadcn add <component>` install for the components listed in `08` §6 (e.g. `class-variance-authority`, `tailwind-merge`, `tw-animate-css`, the Radix/Base UI primitives, `sonner`). Record the exact list they added in `PROGRESS.md`. `next-themes` is **not** approved (see `08` §6).

Rules: exact versions (`"x.y.z"`, no `^`/`~`), check each package's maintenance status and weekly downloads before adding, prefer Node built-ins.

## 7. npm scripts (cross-platform)

```
dev, build, start, lint, lint:fix, format, format:check, typecheck, test, test:watch, test:coverage, test:e2e, check
```
`check` = lint + typecheck + test + build (the local gate before every commit at phase end).

## 8. Documentation deliverables

- `README.md` (Phase 6): hero screenshot, live demo link, features, how it works (diagram), **Security design** section (SSRF defenses, CSP, supply chain), scoring methodology summary, tech stack, local setup, testing, roadmap, license, disclaimer. Bilingual short intro (EN then AR).
- `SECURITY.md`, `LICENSE` (MIT), `CHANGELOG.md` (Keep a Changelog).
- JSDoc on every exported function in `src/lib/**`.

## 9. Performance budgets

- First-load JS on home ≤ 120 KB gzip. No client-side libraries for things CSS can do.
- Images: `next/image`, AVIF/WebP, explicit sizes.
- Fonts subset (Latin + Arabic), `display: swap`.
