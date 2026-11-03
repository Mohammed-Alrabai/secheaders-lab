# Architecture Decision Records

Format per entry: **ADR-NNN — Title** · Date · Status (Accepted / Superseded) · Context · Decision · Consequences. Keep each under ~15 lines.

---

### ADR-001 — Passive-only scanning
2026-11-03 · Accepted
**Context:** Active probing (path brute force, payloads) creates legal/ethical risk and abuse potential for an anonymous public tool.
**Decision:** Only a normal GET (with ≤ 5 validated redirects), one TLS handshake, and an http→https check.
**Consequences:** Safe to run against any public site; findings limited to what is publicly served.

### ADR-002 — Scanner core is framework-agnostic
2026-11-03 · Accepted
**Context:** Testability and possible future CLI / browser-extension reuse.
**Decision:** `src/lib/scanner` has no Next.js imports; dependencies (resolver, clock) are injected.
**Consequences:** Fast unit/integration tests without a server; API route is a thin adapter.

### ADR-003 — Rules defined in typed TypeScript, copy in i18n JSON
2026-11-03 · Accepted
**Context:** Earlier idea was JSON rule files. Typed rules give compile-time safety for IDs, severities and references; text belongs in locale files.
**Decision:** `rules.ts` registry + `checks/*.ts`; all human text in `messages/{en,ar}.json` keyed by RuleId.
**Consequences:** API is language-neutral; adding a rule = rule + messages + tests.

### ADR-004 — PDF via print stylesheet, not a PDF library
2026-11-03 · Accepted
**Context:** JS PDF libraries handle Arabic shaping/RTL poorly and add bundle weight.
**Decision:** Dedicated `@media print` layout; users use the browser's "Save as PDF".
**Consequences:** Perfect Arabic rendering, zero extra dependencies; output depends slightly on browser.

### ADR-005 — Reject IP-literal targets
2026-11-03 · Accepted
**Context:** Many SSRF bypasses use alternative IP encodings.
**Decision:** Only hostnames are accepted; any IP literal form is rejected before DNS.
**Consequences:** Removes a whole bypass class; scanning a bare public IP is not supported (acceptable).

<!-- Agent: append new ADRs below (ADR-006 …) -->

### ADR-006 — shadcn/ui preset `b3JA2ZBtnk` as the design system
2026-11-03 · Accepted
**Context:** The user chose a shadcn/create preset (Rhea, Taupe, Sky, Oxanium, JetBrains Mono, Lucide, small radius).
**Decision:** Use the preset tokens verbatim; extend only with success/warning/grade tokens (`08` §4).
**Consequences:** Consistent, accessible component base; RTL supported via `--rtl`.

### ADR-007 — Single Next.js app, no monorepo
2026-11-03 · Accepted
**Context:** The preset command included `--monorepo` (Turborepo). The product is one app deployed to Netlify; the user had no preference.
**Decision:** Drop `--monorepo`. Keep the scanner isolated as `src/lib/scanner` (ADR-002) instead of a separate package.
**Consequences:** Simpler build and Netlify config, easier for reviewers to read. Can be extracted to a package later if a CLI is built.

### ADR-008 — Arabic font pairing
2026-11-03 · Accepted
**Context:** Oxanium and JetBrains Mono have no Arabic glyphs.
**Decision:** Arabic headings use Changa (squared, technical, matches Oxanium); Arabic body uses IBM Plex Sans Arabic (readability).
**Consequences:** Four font families; subsets limited to latin/arabic to keep payload small.

### ADR-009 — CSP for inline style attributes
2026-11-03 · Accepted (approved by user)
**Context:** shadcn/Radix and React SSR emit inline `style="…"` attributes (e.g. popover positioning). A nonce does not cover style attributes, so a nonce-only `style-src` breaks them.
**Decision:** `style-src 'self' 'nonce-{n}'; style-src-elem 'self' 'nonce-{n}'; style-src-attr 'unsafe-inline'`. `script-src` stays strict (nonce + `strict-dynamic`), so the A+ requirements in `04` are still met.
**Consequences:** Allows inline style attributes only, not `<style>` blocks or scripts. Low risk; document in README security section.

### ADR-010 — Node.js 24 LTS instead of 22
2026-11-03 · Accepted (user approved; deviation from `CLAUDE.md` §7)
**Context:** Node 22 reaches end-of-life in April 2027; Node 24 is supported until April 2028 and is already installed (v24.21.0).
**Decision:** Target Node 24 locally (`.nvmrc`), in CI and on Netlify.
**Consequences:** Longer support window for a public project. `02`/`05` updated; `CLAUDE.md` §7 still says 22 and is superseded by this ADR.

### ADR-011 — pnpm through Corepack without global shims
2026-11-03 · Accepted (user approved)
**Context:** pnpm is not on PATH; `corepack enable` writes shims into the Node install folder (a global change).
**Decision:** Pin pnpm in `package.json` `packageManager` and invoke it as `corepack pnpm …` locally. CI uses `corepack enable` on the runner.
**Consequences:** No machine-wide changes. Docs keep writing `pnpm <script>`; locally it is prefixed with `corepack`.

### ADR-012 — TypeScript 6.0 and ESLint 9 pinned below latest majors
2026-11-03 · Accepted
**Context:** npm `latest` is TypeScript 7.0 and ESLint 10. `typescript-eslint` 8.72 supports `typescript <6.1.0`; `eslint-plugin-react` / `jsx-a11y` / `import` (used by `eslint-config-next` 16.4) support ESLint ≤ 9.
**Decision:** Pin TypeScript 6.0.x and ESLint 9.39.x.
**Consequences:** Strict type-checked linting works. Dependabot major bumps for these two are expected to fail until the ecosystem catches up.

### ADR-013 — HTTPS failure fallback without weakening SC-21
2026-11-03 · Accepted (user approved default)
**Context:** SC-21 requires a validated TLS connection for the page fetch, but `CAP-NO-HTTPS` / `CAP-CERT-INVALID` and worked example 3 expect a result when HTTPS is broken.
**Decision:** If the HTTPS fetch fails (handshake or certificate), fetch `http://<host>/` under the same controls and evaluate those headers. Headers are never read over an untrusted TLS connection. `tls-inspect` still reports the certificate problem.
**Consequences:** Broken-TLS sites get a capped F with explanations instead of an error. `TARGET_UNREACHABLE` only when both fail.

### ADR-014 — All pages rendered dynamically
2026-11-03 · Accepted (user approved default)
**Context:** A per-request CSP nonce and a server-resolved theme cookie both require per-request rendering, which contradicts "Home/About: SSG" in `02` §5.
**Decision:** Render every page dynamically. No static generation.
**Consequences:** Strict CSP kept. Slightly higher TTFB and function invocations; checked against Lighthouse and Netlify limits in Phase 5/6.

### ADR-015 — Redact cookie values in the raw headers panel
2026-11-03 · Accepted (user approved default)
**Context:** `rawHeaders` (FR-07) would expose `Set-Cookie` values, contradicting `04` §4.3 ("never the value").
**Decision:** The scanner replaces each `set-cookie` value with `name=[redacted]; <attributes>` before it leaves `src/lib/scanner`.
**Consequences:** No upstream session tokens in API responses, logs or screenshots.

### ADR-016 — Dark text on the grade C badge
2026-11-03 · Accepted (user approved default)
**Context:** White text on `--grade-c` (amber) in the light theme gives about 2.1:1, below the 3:1 rule in `08` §4.
**Decision:** The grade C badge uses `--warning-foreground` text in both themes. Other grades keep the rule in `08` §4. The contrast unit test enforces it.
**Consequences:** `08` §4 usage rule amended accordingly.

### ADR-017 — Disable the next-intl locale cookie
2026-11-03 · Accepted (user approved default)
**Context:** next-intl sets `NEXT_LOCALE` by default. Our own responses would then carry a `Set-Cookie`, which our own CK rules penalise and which breaks the "own header set = 100 / A+" goal.
**Decision:** `localeCookie: false`. The locale comes from the URL prefix; `/` negotiates from `Accept-Language`.
**Consequences:** Returning visitors to `/` are negotiated again instead of remembered (acceptable).
