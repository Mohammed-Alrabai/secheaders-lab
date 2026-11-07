# 04 — Scoring Specification (v1)

> This document is the single source of truth for checks, deductions, caps and grades.
> Implement it **exactly**. Every rule must have unit tests for each branch below.
> Changing weights or adding rules requires user approval and a spec version bump (`SCORING_VERSION`).

## 1. Model

- Start at **100**. Each failed/warned rule deducts points. Score = `max(0, 100 − Σ deductions)`, integer.
- Some conditions apply a **grade cap** (the grade can be no better than X regardless of score).
- `info` findings never deduct points. `pass` findings deduct 0.
- Header names are case-insensitive. If a header appears multiple times, evaluate per the rule's note (default: the **first** occurrence, and emit an `info` finding `HDR-DUPLICATE` listing the duplicated header names). Exception: multiple CSP headers (or comma-separated policies) are all enforced by browsers — a CSP weakness counts only if it is present in **every** enforced policy, and all policies are shown as evidence (ADR-021, approved 2026-11-07).
- Headers are evaluated on the **final response** after redirects.
- If the final response is not HTTPS, `HDR-HSTS` is evaluated as `fail` (HSTS cannot be delivered over HTTP).

## 2. Grade thresholds

| Grade | Score | Extra requirement |
|---|---|---|
| A+ | ≥ 95 | No `fail` findings at all; `HDR-HSTS` max-age ≥ 31,536,000; `HDR-CSP` status `pass` |
| A | ≥ 90 | |
| B | ≥ 80 | |
| C | ≥ 70 | |
| D | ≥ 60 | |
| F | < 60 | |

If the A+ extra requirements are not met but score ≥ 95 → **A**.

## 3. Caps

| Cap ID | Condition | Max grade |
|---|---|---|
| CAP-NO-HTTPS | HTTPS not available (TLS handshake fails or port 443 closed) | F |
| CAP-CERT-INVALID | Certificate not trusted, expired, not yet valid, or hostname mismatch | F |
| CAP-OLD-TLS | Negotiated protocol below TLS 1.2 | C |
| CAP-NO-HSTS | HSTS missing on an HTTPS site | B |
| CAP-NO-CSP | CSP missing (neither header nor `Report-Only` counts as enforced) | B |

`capsApplied` in the result lists every cap that triggered. The final grade is the **worse** of (threshold grade, lowest cap).

## 4. Rules

Severity drives UI ordering and color; deduction drives the score.

### 4.1 Headers

| Rule ID | Condition | Status | Severity | Deduction |
|---|---|---|---|---|
| **HDR-HSTS** | Missing | fail | high | 20 |
| | `max-age` missing / unparsable / `0` | fail | high | 20 |
| | `max-age` < 15,552,000 (180 days) | warn | medium | 8 |
| | `max-age` ≥ 15,552,000, no `includeSubDomains` | pass + info note | info | 0 |
| | `max-age` 15,552,000 – 31,535,999 **with** `includeSubDomains` (ADR-022) | pass | — | 0 |
| | `max-age` ≥ 31,536,000 + `includeSubDomains` (+ optional `preload`) | pass | — | 0 |
| **HDR-CSP** | Missing (only `Content-Security-Policy-Report-Only` present → also "missing", plus info note) | fail | high | 20 |
| | Present but no `default-src` **and** no `script-src` | warn | medium | 10 |
| | `script-src` (or fallback `default-src`) contains `'unsafe-inline'` **without** a nonce/hash (nonce/hash makes browsers ignore unsafe-inline) | warn | medium | 10 |
| | `script-src`/fallback contains `'unsafe-eval'` | warn | medium | 5 |
| | `script-src`/fallback contains `*`, `http:`, `https:` or `data:` as a source | warn | medium | 5 |
| | `object-src` not `'none'` (and `default-src` not `'none'`) | warn | low | 3 |
| | No `base-uri` (otherwise clean → status stays `pass`, with an info note; ADR-022) | info note | info | 0 |
| | All of the above clean | pass | — | 0 |
| | *(CSP sub-deductions are cumulative, max total for HDR-CSP = 20)* | | | |
| | *`'strict-dynamic'` with a nonce/hash: browsers ignore host/scheme sources (`*`, `http:`, `https:`) and `'unsafe-inline'`, so they do not deduct (ADR-021)* | | | |
| **HDR-FRAME** | Neither `X-Frame-Options` (`DENY`/`SAMEORIGIN`) nor CSP `frame-ancestors` present | fail | medium | 10 |
| | `X-Frame-Options: ALLOW-FROM …` only (obsolete) and no `frame-ancestors` | warn | medium | 8 |
| | Either control present and valid | pass | — | 0 |
| **HDR-XCTO** | `X-Content-Type-Options` missing or value ≠ `nosniff` | fail | medium | 8 |
| **HDR-REFERRER** | Missing (browser default applies) | warn | low | 3 |
| | `unsafe-url` or `no-referrer-when-downgrade` | warn | medium | 5 |
| | Any other valid policy | pass | — | 0 |
| **HDR-PERMISSIONS** | `Permissions-Policy` missing | warn | low | 3 |
| **HDR-COOP** | `Cross-Origin-Opener-Policy` missing | info | info | 0 |
| **HDR-XXSS** | `X-XSS-Protection` present with value `1` / `1; mode=block` (deprecated, can introduce issues) | info | info | 0 |

### 4.2 TLS

| Rule ID | Condition | Status | Severity | Deduction | Cap |
|---|---|---|---|---|---|
| **TLS-AVAILABLE** | HTTPS handshake fails | fail | critical | 30 | CAP-NO-HTTPS |
| **TLS-CERT-VALID** | Not trusted / expired / not yet valid / hostname mismatch | fail | critical | 30 | CAP-CERT-INVALID |
| **TLS-CERT-EXPIRY** | Valid, expires in < 14 days | warn | high | 10 | |
| | Valid, expires in 14–30 days | warn | medium | 5 | |
| **TLS-PROTOCOL** | Negotiated < TLS 1.2 | fail | high | 15 | CAP-OLD-TLS |
| | TLS 1.2 | pass | — | 0 | |
| | TLS 1.3 | pass (info: modern) | — | 0 | |
| **TLS-HTTP-REDIRECT** | `http://host/` does not redirect (≤ 5 hops) to an `https://` URL on the same registrable domain (Public Suffix List via `tldts`, ADR-020) | fail | medium | 10 | |
| | `http://` port 80 unreachable (only HTTPS served) | pass (info) | — | 0 | |

If TLS-AVAILABLE fails, skip TLS-CERT-*, TLS-PROTOCOL (status `info`, "not evaluated").

### 4.3 Cookies (all `Set-Cookie` headers on the final response)

Deductions are per cookie, with a per-rule total cap. Each CK rule produces **one** finding listing the offending cookie names; its status is the worst across cookies (ADR-023).

| Rule ID | Condition (per cookie) | Status | Severity | Deduction | Rule cap |
|---|---|---|---|---|---|
| **CK-SECURE** | HTTPS site and cookie lacks `Secure` | fail | medium | 5 | 10 |
| **CK-HTTPONLY** | Cookie lacks `HttpOnly` | warn | low | 3 | 6 |
| **CK-SAMESITE** | No `SameSite` attribute | warn | low | 3 | 6 |
| | `SameSite=None` without `Secure` | fail | medium | 5 | (within same cap) |
| **CK-PREFIX** | Name starts with `__Host-`/`__Secure-` but violates prefix requirements | fail | medium | 5 | 5 |

No cookies → each CK rule `info` "no cookies set". Evidence shows the cookie **name and attributes only — never the value**.

### 4.4 Information disclosure

| Rule ID | Condition | Status | Severity | Deduction |
|---|---|---|---|---|
| **INF-SERVER** | `Server` header contains a version number (regex `\d+(\.\d+)+`) | warn | low | 3 |
| | `Server` present without version | info | info | 0 |
| **INF-POWERED-BY** | `X-Powered-By` present | warn | low | 3 |
| **INF-ASPNET** | `X-AspNet-Version` or `X-AspNetMvc-Version` present | warn | low | 3 |

## 5. Maximum deductions (sanity check)

Headers 20+20+10+8+5+3 = 66 · TLS 30+30+10+15+10 = 95 · Cookies 10+6+6+5 = 27 · Disclosure 9. Score floors at 0.

## 6. Worked examples (must exist as unit tests)

1. **Perfect site** — HSTS 2y+subdomains+preload, strict nonce CSP, XFO DENY, nosniff, referrer strict-origin-when-cross-origin, permissions policy, TLS 1.3 valid cert 90 days, http→https redirect, cookies `__Host-` + Secure + HttpOnly + SameSite=Lax, no disclosure → **100, A+**.
2. **Typical WordPress** — HSTS max-age 31536000 no subdomains, no CSP, XFO SAMEORIGIN, nosniff, no referrer, no permissions, TLS 1.3, redirect ok, 1 cookie (with `Secure`) without HttpOnly & SameSite, `Server: nginx/1.24.0`, `X-Powered-By: PHP/8.2` → 100 − 20 − 3 − 3 − 3 − 3 − 3 − 3 = **62 → D** (CAP-NO-CSP ≤ B does not improve it) → **D**.
3. **No HTTPS** — only port 80 → HSTS fail 20 + TLS-AVAILABLE 30 + … → cap **F**.
4. **Near-perfect, short HSTS** — as example 1 but `HSTS: max-age=15552000; includeSubDomains` (pass, < 1 year) and no `Permissions-Policy` (−3) → **97**, A+ requirement (max-age ≥ 31,536,000) fails → **A**.
5. **CSP with unsafe-inline and no nonce** — as example 1 but `script-src 'self' 'unsafe-inline'` → −10 → **90, A**.

## 7. Reference mapping rules

- Every rule carries `references: {label, url}[]` in `rules.ts`.
- Allowed sources: OWASP Secure Headers Project, OWASP Cheat Sheet Series (HTTP Headers, Content Security Policy, HSTS, Session Management, TLS), OWASP ASVS (current version — **verify section IDs from the official repository before use**), MDN Web Docs.
- NCA ECC: one **general** informational line on the About page and report (e.g. "These checks support web-application and cryptography controls under the NCA Essential Cybersecurity Controls"); no per-rule control IDs unless verified against the official ECC-2:2024 text and approved by the user. Always show: *"Informational only — not a compliance assessment."*
