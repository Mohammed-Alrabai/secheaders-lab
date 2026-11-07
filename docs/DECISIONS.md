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

### ADR-018 — TLS inspection socket accepts TLS 1.0/1.1
2026-11-03 · Accepted
**Context:** Node defaults to `minVersion: TLSv1.2` and OpenSSL 3 disables TLS 1.0/1.1 ciphers at the default security level. A TLS 1.0-only site would fail the handshake and be scored as `TLS-AVAILABLE` fail (F) instead of `TLS-PROTOCOL` fail with `CAP-OLD-TLS` (C), which is what `04` §4.2 intends.
**Decision:** Only the read-only inspection socket in `tls-inspect.ts` sets `minVersion: 'TLSv1'` and `ciphers: 'DEFAULT:@SECLEVEL=0'`. It already uses `rejectUnauthorized: false` per SC-21, sends no application data and is destroyed after the handshake. The page fetch keeps Node's strict defaults.
**Consequences:** Old protocols are reported correctly. No data is ever exchanged over a weak session. Covered by an integration test against a TLS 1.1-only server.

### ADR-019 — Redirect to an IP literal or reserved name is BLOCKED_TARGET
2026-11-03 · Accepted
**Context:** The SSRF matrix (`03` §9) expects `BLOCKED_TARGET` for a redirect to `http://169.254.169.254/` (case 15) and `INVALID_URL` for a redirect to `file:///` or a non-default port (case 17). The URL policy alone reports IP literals as `INVALID_URL`.
**Decision:** On redirect hops only, `IP_LITERAL` and `RESERVED_NAME` policy failures are reported as `BLOCKED_TARGET`; everything else stays `INVALID_URL`. User input is unchanged (`INVALID_URL`, cases 1–11). Reserved names are now checked before hostname shape, so bare `localhost` reports `RESERVED_NAME`.
**Consequences:** Error codes match the matrix exactly; both codes reject, so no control is relaxed.

### ADR-020 — `tldts` for registrable-domain checks
2026-11-07 · Accepted (user approved new dependency)
**Context:** TLS-HTTP-REDIRECT requires "same registrable domain", which needs the Public Suffix List (e.g. `a.github.io` vs `b.github.io` are different sites).
**Decision:** Add `tldts` 7.4.19 (exact pin, PSL-based, no runtime network access). Only `getDomain` is used, on hostnames that already passed the URL policy.
**Consequences:** Spec-exact behaviour. PSL snapshot ages with the package; Dependabot keeps it current.

### ADR-021 — Browser-accurate CSP evaluation
2026-11-07 · Accepted (user approved; clarifies `04` §1 and §4.1, SCORING_VERSION stays 1 as no results were published)
**Context:** `04` scored the most permissive of several CSPs and penalised `*`/`https:` even under `'strict-dynamic'`, which contradicts how browsers enforce CSP and penalises Google's recommended strict-CSP fallback.
**Decision:** (a) With a nonce or hash plus `'strict-dynamic'`, host/scheme sources and `'unsafe-inline'` in the effective script policy are ignored. (b) With several enforced policies, a sub-check deducts only if every policy has that weakness.
**Consequences:** Fewer false positives; the A+ requirement "HDR-CSP status pass" uses the same logic.

### ADR-022 — Unlisted HSTS / CSP cases are pass
2026-11-07 · Accepted (user approved)
**Context:** `04` §4.1 did not state HSTS 180 d–1 y with `includeSubDomains`, nor a clean CSP lacking only `base-uri`.
**Decision:** Both are `pass` with 0 points; the missing `base-uri` adds an info note. A short HSTS still blocks A+ through the 1-year requirement.
**Consequences:** Matches worked example 4; A+ remains reachable without `base-uri`.

### ADR-023 — One finding per cookie rule
2026-11-07 · Accepted (user approved)
**Context:** `Finding.id` is a RuleId and caps are per rule, but `04` §4.3 phrased conditions per cookie.
**Decision:** Each CK rule yields one finding; evidence lists offending cookie names (never values); status is the worst across cookies; deduction is the per-cookie sum capped by the rule cap. Worked example 2's cookie has `Secure` (otherwise its stated 62 would be 57).
**Consequences:** Stable result shape; UI lists cookie names inside one card per rule.

### ADR-024 — Rate limiting: Netlify platform rule primary, in-memory bucket secondary
2026-11-07 · Accepted (implements SC-24; platform part configured in Phase 6 with approval)
**Context (verified in Netlify docs 2026-11-07):** Code-based rate-limit rules exist on all plans (free plan: 2 per project) and return HTTP 429; Netlify does not document a `Retry-After` on that response. Rules are declared in a Netlify Function's `config.rateLimit` or on a `netlify.toml` redirect (`[redirects.rate_limit]`), not inside a Next.js Route Handler, and can take up to ~10 s to start blocking. Synchronous functions have a fixed 60 s limit, which fits the 8 s scan budget. No client-IP request header is documented for Next.js handlers.
**Decision:** Primary: a `netlify.toml` redirect rule for `/api/scan` with `window_limit = 10`, `window_size = 60`, `aggregate_by = ["ip", "domain"]`, verified empirically at deploy (T-3). Secondary: the per-instance token bucket in `rate-limit.ts`, keyed best-effort by `x-nf-client-connection-ip` / first `x-forwarded-for`; the key is never logged or stored.
**Consequences:** The app's own 429 carries `Retry-After`; the platform's may not, so the UI must not depend on it. The secondary limiter can be bypassed by spoofed headers or instance spread; it only slows a single client.

### ADR-025 — `FORBIDDEN_ORIGIN` (403) for the same-origin check
2026-11-07 · Accepted
**Context:** SC-25 requires rejecting a cross-origin `Origin`, but `02` §4 had no matching code.
**Decision:** Add public code `FORBIDDEN_ORIGIN` → HTTP 403. Requests without `Origin` (non-browser clients) are allowed, as SC-25 states ("when present").
**Consequences:** The contract gains one code; the UI never triggers it (same origin). Deploy previews need their origin allowed (T-6, Phase 6).

### ADR-026 — Theme: client-written cookie, server-applied class, CSS for "system"
2026-11-07 · Accepted
**Context:** `06` §1 / `08` §6 require a server-resolved theme with no inline script (strict CSP) and no flash; ADR-017 requires our responses to carry no `Set-Cookie`.
**Decision:** The theme menu writes `theme=light|dark` with `document.cookie` (SameSite=Lax, Secure on HTTPS, 1 year) and swaps the `<html>` class; the layout reads the cookie and renders the class on the next request. With no cookie, `@media (prefers-color-scheme: dark) :root:not(.light)` applies a copy of the dark tokens; a unit test keeps that copy identical to the `.dark` blocks. The Tailwind `dark:` variant covers both cases.
**Consequences:** No script, no flash, no server `Set-Cookie`. The dark tokens exist twice in CSS (guarded by the test).

### ADR-027 — Copy confirmations without `sonner`
2026-11-07 · Accepted
**Context:** `08` §6 lists `sonner` for copy toasts, but it injects `<style>` at runtime (T-7), which conflicts with a nonce-only `style-src-elem`. `06` §2 asks for a live-region announcement.
**Decision:** Copy buttons swap their icon to a check mark and announce "Copied" in a polite `role="status"` region. `sonner`, `tooltip`, `progress` and `scroll-area` are not installed.
**Consequences:** Fewer dependencies and no runtime style injection; T-7 is reduced to Base UI only.

### ADR-028 — Reusable remediation instruction keys
2026-11-07 · Accepted
**Context:** Per-platform-per-rule instruction keys would need ~70 near-duplicate strings per language.
**Decision:** 17 parameterised instruction texts (`remediation.steps.*`); Cloudflare wording follows Cloudflare's docs as checked on 2026-11-07 (Edge Certificates, Response Header Transform Rules; the unverified claim that Cloudflare rewrites `Server` was dropped).
**Consequences:** Smaller, consistent copy; a test asserts every key is used and translated.

### ADR-029 — Remove `interest-cohort` from our Permissions-Policy
2026-11-07 · Accepted (user approved change to `03` §6)
**Context:** FLoC was withdrawn; Chrome logs "Unrecognized feature: 'interest-cohort'" as a console error, which conflicts with the zero-console-error goal and Lighthouse Best Practices.
**Decision:** Our Permissions-Policy is `camera=(), microphone=(), geolocation=(), payment=(), usb=()`.
**Consequences:** No change to our own grade (HDR-PERMISSIONS only checks presence).

### ADR-030 — Nonce CSP composed with next-intl in `proxy.ts`
2026-11-07 · Accepted
**Context:** Next.js applies a nonce it finds in the request's CSP header; our proxy also runs next-intl routing.
**Decision:** The proxy builds the `03` §6 CSP with a 128-bit nonce, sets it (and `x-nonce`) on the request it passes to next-intl (which forwards request headers), then sets the same CSP on the response. Static security headers stay in `next.config.ts`; API and brand files get locked-down CSPs.
**Verification:** Production build, all pages exercised: 0 CSP violations; positive controls show an injected inline event handler, a parser-inserted inline script and an inline `<style>` are each blocked and reported. Scripts created by already-running JavaScript are allowed by `'strict-dynamic'` by design. No runtime `<style>` injection from Base UI (T-7 closed).

### ADR-031 — `--link` token for primary-coloured text
2026-11-07 · Accepted
**Context:** The contrast test (`08` §4 pairings, both themes) found dark `--primary` used as text on `--background` at 2.6:1, below WCAG AA 4.5:1. `--primary` itself is a preset token and must not change.
**Decision:** Add `--link` (`text-link`): light = `var(--primary)`, dark = `var(--sidebar-primary)`. Text and links use `text-link`; `--primary` stays for fills (buttons, focus rings). The muted chip uses the same tint/mix formula as the other chips.
**Consequences:** Every token pairing passes AA in both themes, enforced by `tests/unit/contrast.test.ts`. Preset tokens unchanged.

### ADR-032 — Open Graph images rendered by the browser, committed as PNGs
2026-11-07 · Accepted (deviation from `src/app/[locale]/opengraph-image.tsx` in `08` §9; the output meets `06` §6 "static, branded, EN and AR")
**Context:** `next/og` (Satori) does not shape Arabic text (no contextual letter forms, no bidi), and loading fonts for it at runtime would add a fetch path we do not need.
**Decision:** `pnpm og:generate` runs a Playwright spec (`playwright.og.config.ts`) that renders a 1200×630 card with the app's own self-hosted fonts and tokens and saves `public/og/{en,ar}.png`. The locale layout references them in `openGraph` / `twitter` metadata via `metadataBase`.
**Consequences:** Correct Arabic shaping, zero runtime cost, static files covered by our headers. Images must be regenerated when the tagline or brand changes.

### ADR-033 — Zod runs jitless
2026-11-07 · Accepted
**Context:** Zod 4 probes `Function('')` on first parse to decide whether to JIT-compile schemas. Our page CSP forbids eval, so the probe is blocked: harmless, but Chrome records a CSP issue (Lighthouse Best Practices 96 on the results page).
**Decision:** `z.config({ jitless: true })` in `src/lib/schemas.ts`, the only module that parses on the client. The CSP e2e test also fails on DevTools `ContentSecurityPolicyIssue`s, not only `securitypolicyviolation` events.
**Consequences:** No eval attempt anywhere; CSP unchanged. Parsing a ~20 KB result without JIT is negligible.

### ADR-034 — Lighthouse target scope (NFR-01)
2026-11-07 · Accepted (user approved with the Phase 5 gate)
**Context:** Home and About in both locales score ≥ 95 on all four categories. The results page (`/en/scan?url=example.com`, live scan) scores Performance 89 (LCP 3.7 s: the largest element is the report, which can only render after the scan of a third-party site returns) and SEO 66 (`noindex` is required by `06` §6).
**Decision:** Apply the "≥ 95 ×4" target to the indexable pages; record results-page scores as informational with Accessibility and Best Practices still required at 100.
**Consequences:** No change to `noindex`; no artificial LCP tricks.
