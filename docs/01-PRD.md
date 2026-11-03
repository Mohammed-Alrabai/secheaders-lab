# 01 — Product Requirements (PRD)

## 1. Summary

**SecHeaders Lab** lets anyone enter a website URL and, within seconds, get a passive security review of what the site
already sends to every browser: HTTP security headers, TLS/certificate status, cookie attributes and information
disclosure. The result is a **score (0–100) and grade (A+ → F)**, a plain-language explanation of every finding, and
**copy-ready fix snippets** for common server platforms. Available in **English (default) and Arabic (RTL)**.

## 2. Goals

| # | Goal | Measure |
|---|---|---|
| G1 | Showcase senior full-stack + AppSec skills in a public repo | Clean architecture, ≥90% coverage on scanner core, CI with security scanning, excellent README |
| G2 | Useful in 10 seconds for a recruiter or engineer | Scan completes in < 8 s for typical sites; result is understandable without docs |
| G3 | Differentiate from existing tools | Per-platform fix snippets, bilingual UI, OWASP mapping, printable report |
| G4 | The tool itself is secure | SSRF-proof fetcher, strict CSP, the site scores **A+ on itself** |

## 3. Non-goals (explicitly out of scope)

- Active vulnerability scanning, crawling, fuzzing, port scanning, directory brute-forcing.
- User accounts, login, payments, server-side storage of scan history.
- Scanning private/internal networks or IP-literal targets.
- Being a formal compliance assessment. Standard mappings are **informational only**.

## 4. Target users

1. **Developers / DevOps** checking their own site before or after a release.
2. **Security / IT admins** needing a quick report to attach to a change request or audit evidence.
3. **Recruiters / hiring engineers** evaluating the author's work.

## 5. Differentiators

1. **Copy-ready remediation** per platform: Nginx, Apache, IIS (`web.config`), Next.js (`next.config`), Netlify (`_headers` / `netlify.toml`), Cloudflare (instructions).
2. **Bilingual EN/AR** UI and report with proper RTL.
3. **Standards references** per finding: OWASP Secure Headers Project / OWASP Cheat Sheets / OWASP ASVS (verified IDs only) and MDN. Optional general NCA ECC note, clearly labelled informational.
4. **Printable PDF report** (via a print-optimized view) suitable for change-request or audit attachments.
5. **Transparent methodology** page that documents every check and weight (`docs/04-SCORING-SPEC.md` rendered for users).

## 6. Functional requirements — MVP (v1.0)

| ID | Requirement |
|---|---|
| FR-01 | User enters a URL or bare domain (`example.com` → `https://example.com`). Input validated client- and server-side. |
| FR-02 | Server performs one passive scan: GET on final URL (following up to 5 validated redirects), TLS handshake inspection, and an `http://` → `https://` redirect check. |
| FR-03 | Evaluate all checks in `docs/04-SCORING-SPEC.md` (headers, TLS, cookies, disclosure). |
| FR-04 | Compute score and grade exactly per the scoring spec, including caps. |
| FR-05 | Results page: grade badge, score, summary counts, findings grouped by category, each with status, severity, evidence (observed header value), "Why it matters", "How to fix" (platform tabs with copy button) and references. |
| FR-06 | Shareable URL: `/{locale}/scan?url=<encoded>` re-runs the scan when opened. |
| FR-07 | Raw response headers panel (sanitized, truncated). |
| FR-08 | Redirect chain display (URL + status per hop). |
| FR-09 | Print / "Save as PDF" report view with header, date, target, grade, findings and fixes; works in both languages. |
| FR-10 | Language switch EN ↔ AR preserving the current page and query. |
| FR-11 | Light/dark theme following system preference, with manual toggle. |
| FR-12 | Methodology page (`/about`) explaining checks, scoring, limitations, privacy and terms. |
| FR-13 | Clear, localized error states: invalid URL, blocked target, unreachable, timeout, rate-limited. |

## 7. Functional requirements — v1.1 (after MVP, only if approved)

- DNS email security: SPF and DMARC records.
- `/.well-known/security.txt` presence and expiry.
- CORS (`Access-Control-Allow-Origin: *` with credentials), COOP/COEP/CORP scoring.
- Local (browser-only) scan history and "compare two scans".
- Downloadable JSON result.

## 8. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 Performance | p95 scan duration < 8 s; Lighthouse ≥ 95 on Performance, Accessibility, Best Practices, SEO. |
| NFR-02 Security | All controls in `03-SECURITY-CONTROLS.md`; site itself grades A+ on SecHeaders Lab and on Mozilla Observatory. |
| NFR-03 Accessibility | WCAG 2.2 AA; full keyboard navigation; axe-core: zero serious/critical violations. |
| NFR-04 Privacy | No analytics, no cookies except an optional theme/locale preference, no server-side storage of scanned URLs or results. |
| NFR-05 Reliability | Graceful handling of non-200 responses, missing TLS, slow targets and malformed headers. Never a 500 with a stack trace. |
| NFR-06 Maintainability | Checks are isolated, typed, individually tested modules; adding a check = one rule file + messages + tests. |
| NFR-07 Cost | Runs on Netlify free tier; no paid services. |

## 9. Success criteria for launch

- All MVP FRs implemented and tested; CI green.
- SecHeaders Lab scores itself **A+**.
- README with screenshots (EN + AR), architecture diagram, security design section, and live demo link.
- Added to LinkedIn **Projects** and **Featured**, with a launch post.

## 10. Legal & ethics

- Footer and `/about` state: passive, read-only inspection of publicly served responses; not a penetration test; results informational; use only on sites you are authorized to assess responsibly.
- No storage of scan targets. Server logs must not persist full URLs beyond the platform default.
