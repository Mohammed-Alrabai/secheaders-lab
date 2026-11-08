# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). The scoring model has its own version
(`SCORING_VERSION`), which is returned with every result.

## [Unreleased]

## [1.1.0] - 2026-11-08

### Added

- **Download JSON** on the results page: the full result as a file, built in the browser (no request, nothing
  stored), named `secheaders-<host>-<date>.json`. English and Arabic labels.
- The IP policy is tested against the official IANA IPv4 and IPv6 special-purpose registries.
- Every CI run writes its test counts and coverage to the run page.

### Changed

- The explicit IPv6 block list now includes `2001::/23` (IETF protocol assignments). Those addresses were
  already refused; the list no longer depends on the IP library for them.

## [1.0.1] - 2026-11-08

Security hardening from an external review of the repository. No scoring or API changes.

### Fixed

- When HTTPS fails, the HTTP fallback now requests only the site's root (`http://<host>/`), as documented in
  ADR-013. Previously the submitted path and query, which may carry tokens, were sent over plain HTTP.
- The HTTP-to-HTTPS redirect check no longer sends a request to a different site: it stops before any redirect
  that leaves the scanned site (tenants of shared hosts such as `github.io` count as different sites).
- A request body that fails or is cancelled while it is read now returns a `400` error with `no-store` instead
  of an unhandled server error.
- README test counts.

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

[Unreleased]: https://github.com/Mohammed-Alrabai/secheaders-lab/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Mohammed-Alrabai/secheaders-lab/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/Mohammed-Alrabai/secheaders-lab/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Mohammed-Alrabai/secheaders-lab/releases/tag/v1.0.0
