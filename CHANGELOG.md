# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). The scoring model has its own version
(`SCORING_VERSION`), which is returned with every result.

## [Unreleased]

## [1.0.0] - 2026-11-08

First public release, live at https://secheaders-lab.netlify.app.

### Added

- Passive scan of a public website: one `GET` request (up to 5 validated redirects), a TLS handshake and an
  http→https redirect check.
- 21 checks across security headers, TLS, cookies and information disclosure, with a score from 0 to 100 and a
  grade from A+ to F, including grade caps (scoring model v1).
- Copy-ready fixes for Nginx, Apache, IIS, Next.js, Netlify and Cloudflare, with MDN and OWASP references.
- Results page with summary counts, evidence, redirect chain, sanitized raw headers and shareable links.
- Print / Save as PDF report (A4, page numbers, failing findings expanded).
- English and Arabic (RTL) interface, light and dark themes, methodology page generated from the scoring code.
- SSRF defenses: strict URL policy, public-address-only DNS validation, IP-pinned connections against DNS
  rebinding, re-validated manual redirects, timeouts and a total scan budget.
- API hardening: same-origin check, JSON only, 4 KB body limit, strict schema, rate limiting, `no-store`, safe
  error codes and minimal logs.
- Own security headers that score A+: per-request nonce CSP with `'strict-dynamic'`, HSTS with preload,
  framing, MIME, referrer, permissions, COOP and CORP policies.
- Open Graph images in English and Arabic, canonical and hreflang links, `robots.txt` and `sitemap.xml`.
- Privacy Policy, Terms of Use and Cookie Policy pages in English and Arabic, and an informational
  first-visit cookie notice (no tracking cookies; the site has one optional theme cookie).
- Unit, integration and end-to-end test suites (including accessibility, CSP and keyboard-only tests) and CI
  with CodeQL, Semgrep, Gitleaks and `pnpm audit`.

[Unreleased]: https://github.com/Mohammed-Alrabai/secheaders-lab/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Mohammed-Alrabai/secheaders-lab/releases/tag/v1.0.0
