# 02 — Architecture

## 1. Stack (pin exact versions in `package.json`; verify latest stable at Phase 0)

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node.js 24 LTS (ADR-010) | Scanner needs Node APIs (`dns`, `tls`, `net`) → **never** Edge runtime |
| Framework | Next.js (latest stable, App Router) + React | Route Handler for API, `export const runtime = 'nodejs'` |
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` | |
| Styling | Tailwind CSS v4 + **shadcn/ui** (preset `b3JA2ZBtnk`, `--rtl`) | Tokens and components per `08-DESIGN-SYSTEM.md`; logical properties for RTL |
| i18n | `next-intl` | Locales `en` (default), `ar`; prefix routing `/en`, `/ar` |
| Validation | `zod` | Request + response schemas |
| IP logic | `ipaddr.js` | Range classification (v4, v6, v4-mapped v6) |
| HTTP client | `undici` (`request` + custom `Agent` with pinned `connect.lookup`) | Manual redirects, timeouts, size limits |
| Icons | `lucide-react` | Tree-shaken SVG, no runtime fetch |
| Fonts | `next/font/google` (self-hosted at build): Oxanium, JetBrains Mono, IBM Plex Sans Arabic, Changa | See `08` §3; no runtime third-party requests |
| Tests | Vitest (+ coverage v8), Playwright + `@axe-core/playwright` | |
| Hosting | Netlify (Next.js runtime / OpenNext adapter) | Free tier |
| CI | GitHub Actions + CodeQL + Semgrep + Gitleaks + Dependabot | |

## 2. High-level flow

```
Browser ──POST /api/scan {url}──▶ Route Handler (Node runtime)
                                   │ 1. zod-validate body
                                   │ 2. rate-limit check
                                   │ 3. scan(url)  ── src/lib/scanner (pure, framework-agnostic)
                                   │      ├─ urlPolicy.normalize+validate
                                   │      ├─ dnsResolve → ipPolicy.assertPublic (ALL addresses)
                                   │      ├─ safeFetch (pinned IP, manual redirects ≤5, revalidate each hop)
                                   │      ├─ tlsInspect (pinned IP, SNI=hostname)
                                   │      ├─ httpToHttpsCheck (safeFetch on http://host/)
                                   │      ├─ run checks[] → Finding[]
                                   │      └─ scoring.compute → {score, grade}
                                   │ 4. zod-validate ScanResult (output contract)
◀──────── 200 ScanResult JSON ──────┘   errors → typed ScanError → HTTP status + code (no internals)
```

The **scanner core has zero dependency on Next.js**. It must be callable from a unit test or a CLI script.

## 3. Repository structure

```
secheaders-lab/
├─ CLAUDE.md · AGENTS.md · README.md · PROGRESS.md · LICENSE (MIT) · SECURITY.md
├─ docs/                       # planning + ADRs (this folder)
├─ messages/
│  ├─ en.json
│  └─ ar.json
├─ public/                     # static assets, og-image, favicon
├─ src/
│  ├─ app/
│  │  ├─ [locale]/
│  │  │  ├─ layout.tsx         # html lang/dir, fonts, theme
│  │  │  ├─ page.tsx           # home: hero + scan form
│  │  │  ├─ scan/page.tsx      # results (client fetch, shareable ?url=)
│  │  │  ├─ about/page.tsx     # methodology, scoring, privacy, terms
│  │  │  └─ not-found.tsx
│  │  ├─ api/scan/route.ts     # POST only, runtime nodejs
│  │  └─ robots.ts · sitemap.ts
│  ├─ components/              # UI (ScanForm, GradeBadge, FindingCard, FixTabs, CodeBlock, ...)
│  ├─ i18n/                    # next-intl routing + request config
│  ├─ proxy.ts                 # locale routing + CSP nonce (Next 16 rename of middleware.ts)
│  └─ lib/
│     ├─ scanner/
│     │  ├─ index.ts           # scan() orchestrator + overall time budget
│     │  ├─ types.ts           # Finding, ScanResult, Severity, Status, RuleId
│     │  ├─ errors.ts          # ScanError + codes
│     │  ├─ url-policy.ts
│     │  ├─ ip-policy.ts
│     │  ├─ dns.ts
│     │  ├─ safe-fetch.ts
│     │  ├─ tls-inspect.ts
│     │  ├─ header-utils.ts    # parsing (case-insensitive, multi-value, CSP parser)
│     │  ├─ checks/            # one file per rule group: hsts.ts csp.ts frame.ts xcto.ts referrer.ts permissions.ts tls.ts cookies.ts disclosure.ts
│     │  ├─ rules.ts           # registry: RuleId → meta (category, severity, references)
│     │  └─ scoring.ts
│     ├─ remediation/          # snippets per RuleId × Platform
│     ├─ schemas.ts            # zod request/response schemas (shared client/server)
│     └─ rate-limit.ts
├─ tests/
│  ├─ unit/ · integration/ (local HTTP/HTTPS servers + mocked DNS) · e2e/ (Playwright)
│  └─ fixtures/                # header sets, self-signed certs generated at test time
├─ .github/workflows/ci.yml · codeql.yml · dependabot.yml
├─ netlify.toml · .env.example · .editorconfig · .gitignore · .nvmrc
└─ package.json · pnpm-lock.yaml · tsconfig.json · eslint.config.mjs · vitest.config.ts · playwright.config.ts
```

## 4. API contract

### `POST /api/scan`

Request (`application/json`, max 4 KB):
```json
{ "url": "example.com" }
```

Success `200` — `ScanResult`:
```ts
type Status = 'pass' | 'warn' | 'fail' | 'info';
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
type Category = 'headers' | 'tls' | 'cookies' | 'disclosure';

interface Finding {
  id: RuleId;                // e.g. "HDR-HSTS"
  category: Category;
  status: Status;
  severity: Severity;
  deduction: number;         // points actually deducted (after caps), >= 0
  evidence?: { header?: string; value?: string; detail?: string }; // values truncated to 512 chars
  messageKey: string;        // i18n key variant, e.g. "HDR-HSTS.missing"
  params?: Record<string, string | number>; // interpolation values
}

interface ScanResult {
  schemaVersion: 1;
  scannedAt: string;         // ISO 8601
  durationMs: number;
  target: {
    input: string;
    finalUrl: string;
    redirectChain: { url: string; status: number }[];
    httpStatus: number;
  };
  tls: { available: boolean; protocol?: string; validTo?: string; issuer?: string; authorized?: boolean };
  score: number;             // 0–100 integer
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  capsApplied: string[];     // cap ids from scoring spec
  summary: { pass: number; warn: number; fail: number; info: number };
  findings: Finding[];
  rawHeaders: { name: string; value: string }[]; // lowercase names, values truncated to 2 KB, max 100 entries
}
```

Text is **not** returned by the API; the client resolves `messageKey` + `params` via `next-intl`. This keeps the API language-neutral.

Errors — body `{ "error": { "code": ErrorCode } }`, never stack traces, resolved IPs or internal detail:

| HTTP | code | When |
|---|---|---|
| 400 | `INVALID_URL` | Fails parsing / policy (scheme, port, credentials, length, IP literal) |
| 413 | `PAYLOAD_TOO_LARGE` | Body > 4 KB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Not JSON |
| 422 | `BLOCKED_TARGET` | Resolves to non-public address, or a redirect does |
| 422 | `DNS_NOT_FOUND` | NXDOMAIN / no A/AAAA |
| 429 | `RATE_LIMITED` | Rate limit exceeded (include `Retry-After`) |
| 502 | `TARGET_UNREACHABLE` | Connection refused/reset, TLS fatal on both http and https |
| 504 | `TARGET_TIMEOUT` | Budget exceeded |
| 500 | `INTERNAL` | Unexpected — logged server-side without the URL query string |

Other methods on `/api/scan` → `405` with `Allow: POST`.

## 5. Rendering strategy

- Home and About: static (SSG) per locale.
- Results page: server-rendered shell, client component performs the POST (so shared links work and the API stays the single scan path). Show skeleton + progress text while scanning.
- All pages send the security headers defined in `03-SECURITY-CONTROLS.md` §6.

## 6. Configuration

`.env.example` (no secrets needed in MVP):
```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SCAN_TOTAL_BUDGET_MS=8000
SCAN_RATE_LIMIT_PER_MIN=10
```
All env access goes through one validated module (`src/lib/env.ts`, zod).

## 7. Deployment (Phase 6, with user approval)

- Netlify site linked to the GitHub repo; build `pnpm build`; Node 22.
- Verify **current** Netlify docs for: Next.js adapter, function timeout limits (budget must fit), and platform rate-limiting configuration. Record findings in `DECISIONS.md`.
- Preview deploys for PRs; production from `main` only.
