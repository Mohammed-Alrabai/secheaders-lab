# 03 — Security Controls (non-negotiable)

> SecHeaders Lab fetches URLs supplied by anonymous users from a cloud function. That is a textbook
> **Server-Side Request Forgery (SSRF)** surface. Netlify Functions run on cloud infrastructure where
> link-local metadata endpoints (e.g. `169.254.169.254`) exist. A security tool with an SSRF bug would
> destroy the credibility of this portfolio. Every control below is **mandatory** and **tested**.
> Changing any of them requires explicit user approval (see `CLAUDE.md` §5).

Control IDs (`SC-xx`) must be referenced in code comments where implemented and in test names.

## 1. Input policy — `url-policy.ts`

| ID | Control |
|---|---|
| SC-01 | Max input length 2,048 chars; trim whitespace; reject control characters (`\x00–\x1F`, `\x7F`) including encoded CR/LF. |
| SC-02 | If no scheme, prepend `https://`. Allow **only** `http:` and `https:`. Reject everything else (`file:`, `ftp:`, `gopher:`, `data:`, `javascript:`, `ws:` …). |
| SC-03 | Parse with WHATWG `URL`. Reject if parsing fails. |
| SC-04 | Reject URLs containing credentials (`username` or `password` non-empty). |
| SC-05 | Allow only default ports (none, `80`, `443`). Reject any other explicit port. |
| SC-06 | Reject IP-literal hosts in **any** form: dotted IPv4, IPv6 `[...]`, decimal (`2130706433`), hex (`0x7f000001`), octal, short forms (`127.1`). Rule: after WHATWG parsing, if hostname is an IP (ipaddr.js `isValid`) or WHATWG normalized it into one → reject. |
| SC-07 | Hostname must contain at least one dot, labels ≤ 63 chars, total ≤ 253, after IDNA/punycode normalization (WHATWG does this). Strip a single trailing dot before checks. |
| SC-08 | Reject reserved / internal names and suffixes: `localhost`, `*.localhost`, `*.local`, `*.internal`, `*.intranet`, `*.lan`, `*.home.arpa`, `*.corp`, `*.test`, `*.invalid`, `*.example`, `*.onion`, `*.arpa`. (`example.com/.net/.org` are ordinary public domains and are allowed.) Keep the list in one constant. |
| SC-09 | Discard the URL fragment. Keep path and query (they are part of what the user asked to scan) but never log them. |

## 2. Network destination policy — `ip-policy.ts` + `dns.ts`

| ID | Control |
|---|---|
| SC-10 | Resolve with `dns.promises.lookup(host, { all: true, verbatim: true })`. Timeout 2 s. |
| SC-11 | **Every** resolved address must be public unicast. If **any** address is non-public → `BLOCKED_TARGET`. |
| SC-12 | Non-public = ipaddr.js range ≠ `unicast`, covering at least: unspecified `0.0.0.0/8`, private `10/8`, `172.16/12`, `192.168/16`, loopback `127/8`, link-local `169.254/16`, CGNAT `100.64/10`, `192.0.0/24`, `192.0.2/24`, `198.18/15`, `198.51.100/24`, `203.0.113/24`, multicast `224/4`, reserved `240/4`, broadcast; IPv6 `::`, `::1`, `fc00::/7`, `fe80::/10`, `ff00::/8`, `64:ff9b::/96` (NAT64), `2001:db8::/32`, and **IPv4-mapped IPv6** (`::ffff:a.b.c.d`) which must be unwrapped and re-checked as IPv4. Add explicit unit tests for each. |
| SC-13 | **DNS-rebinding protection / IP pinning.** The socket must connect to the exact address that was validated. Implement with an `undici.Agent` whose `connect.lookup` returns the pre-validated address only; set `servername` to the hostname for TLS SNI and keep `Host` header = hostname. A second resolution must never occur between check and connect. |
| SC-14 | Prefer one address (first valid IPv4, else IPv6). Do not try every address. |

## 3. Fetch behaviour — `safe-fetch.ts`

| ID | Control |
|---|---|
| SC-15 | Method `GET` only. No request body. |
| SC-16 | Fixed request headers only: `User-Agent: SecHeadersLab/<version> (+<site>/about)`, `Accept: text/html,*/*;q=0.8`, `Accept-Language: en`. **Never** forward any incoming client header, cookie or IP. |
| SC-17 | Redirects handled **manually** (`maxRedirections: 0`). Max **5** hops. Each `Location` is resolved relative to the current URL and passes **SC-01…SC-14 again** before being followed. Loop detection by visited set. |
| SC-18 | Timeouts: connect 3 s; headers 4 s per hop; whole scan budget `SCAN_TOTAL_BUDGET_MS` (default 8 s) enforced with one `AbortController` across all steps. |
| SC-19 | Body: do not read beyond **64 KB**; MVP needs headers only → read nothing and destroy the body stream immediately after headers. |
| SC-20 | Response header limits: max 100 headers kept, each value truncated to 2 KB for display; total header bytes cap enforced by undici defaults (`maxHeaderSize`) — set explicitly to 64 KB. |
| SC-21 | TLS for the page fetch: normal validation (`rejectUnauthorized: true`). Certificate details are gathered separately by `tls-inspect.ts` with `rejectUnauthorized: false` **only to read** the certificate and `authorized` / `authorizationError`; no application data is sent on that socket. |
| SC-22 | No cookies stored or sent between hops (no cookie jar). |

## 4. API endpoint hardening — `app/api/scan/route.ts`

| ID | Control |
|---|---|
| SC-23 | `POST` only; `Content-Type: application/json` required; body ≤ 4 KB; zod-validated; unknown fields rejected (`.strict()`). |
| SC-24 | **Rate limiting:** 10 scans / minute / client IP. Primary: Netlify platform rate-limit rule (verify current docs, record in ADR). Defense-in-depth: in-memory token bucket per function instance. Return `429` + `Retry-After`. |
| SC-25 | Same-origin only: check `Origin` (when present) equals `NEXT_PUBLIC_SITE_URL`; no CORS headers emitted. |
| SC-26 | Errors mapped to the codes in `02-ARCHITECTURE.md` §4. Never return stack traces, resolved IPs, DNS details, or upstream error messages. |
| SC-27 | Response `Cache-Control: no-store`. |
| SC-28 | Output validated with the `ScanResult` zod schema before sending (prevents leaking unexpected fields). |

## 5. Output handling (XSS from scanned content)

| ID | Control |
|---|---|
| SC-29 | Everything from the target (header names/values, URLs in redirect chain, cert issuer) is **untrusted**. Render only as React text nodes. No `dangerouslySetInnerHTML`, no markdown rendering of upstream data. |
| SC-30 | Links in the redirect chain are rendered as plain text, not clickable anchors (prevents `javascript:` and phishing). The final URL may be shown with a copy button only. |
| SC-31 | Strip/escape control characters and bidi override characters (`U+202A–U+202E`, `U+2066–U+2069`) from displayed upstream values (Trojan-Source style spoofing, especially relevant in an RTL UI). |

## 6. SecHeaders Lab's own response headers (must grade A+ on itself)

Set via `middleware.ts` (nonce) and `netlify.toml` / `next.config` headers:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{random}' 'strict-dynamic'; style-src 'self' 'nonce-{random}'; style-src-elem 'self' 'nonce-{random}'; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```
- No `X-Powered-By` (`poweredByHeader: false`). No `Server` version disclosure where controllable.
- `style-src-attr 'unsafe-inline'` is approved (ADR-009) for inline `style` attributes emitted by shadcn/Radix/React SSR. Any further relaxation (e.g. `'unsafe-inline'` in `style-src-elem` or anything in `script-src`) requires asking the user. Do not silently weaken CSP.

## 7. Supply chain & repository

| ID | Control |
|---|---|
| SC-32 | Exact-pinned dependencies, lockfile committed, `pnpm install --frozen-lockfile` in CI. |
| SC-33 | Dependabot (npm + GitHub Actions) weekly. GitHub Actions pinned to full commit SHA. |
| SC-34 | CI security jobs: CodeQL (javascript-typescript), Semgrep (`p/owasp-top-ten`, `p/typescript`, `p/nextjs`), Gitleaks, `pnpm audit --audit-level=high`. Failing high/critical findings block merge. |
| SC-35 | `SECURITY.md` with responsible-disclosure contact (user to provide email in Phase 6). |
| SC-36 | Least-privilege workflow tokens: `permissions: contents: read` at workflow level; elevate per job only where required (CodeQL `security-events: write`). |

## 8. Logging & privacy

| ID | Control |
|---|---|
| SC-37 | Log only: timestamp, outcome code, duration, target **hostname** (no path/query), and rule count. No client IP stored by the app. |
| SC-38 | No server-side persistence of results. No analytics. |

## 9. Mandatory SSRF test matrix (Phase 1)

Each line below is a named test case. All must be **rejected** (with the stated code) unless marked *accept*.

| # | Input / scenario | Expected |
|---|---|---|
| 1 | `http://localhost` / `http://localhost.` / `http://app.localhost` | INVALID_URL |
| 2 | `http://127.0.0.1`, `http://127.1`, `http://2130706433`, `http://0x7f000001`, `http://0177.0.0.1` | INVALID_URL |
| 3 | `http://[::1]`, `http://[::ffff:127.0.0.1]`, `http://[::ffff:7f00:1]` | INVALID_URL |
| 4 | `http://0.0.0.0`, `http://10.0.0.1`, `http://192.168.1.1`, `http://172.16.0.1`, `http://100.64.0.1` | INVALID_URL |
| 5 | `http://169.254.169.254/latest/meta-data/` | INVALID_URL |
| 6 | `http://metadata.google.internal`, `http://printer.local`, `http://server.corp` | INVALID_URL |
| 7 | `file:///etc/passwd`, `ftp://example.com`, `gopher://example.com`, `javascript:alert(1)`, `data:text/html,x` | INVALID_URL |
| 8 | `https://user:pass@example.com` | INVALID_URL |
| 9 | `https://example.com:8443`, `http://example.com:22` | INVALID_URL |
| 10 | `https://example.com/%0d%0aX-Injected:1`, input with raw `\r\n` | INVALID_URL |
| 11 | 2,049-char URL | INVALID_URL |
| 12 | Public-looking domain whose mocked DNS returns `10.0.0.5` | BLOCKED_TARGET |
| 13 | Domain returning `[93.184.216.34, 127.0.0.1]` (mixed) | BLOCKED_TARGET |
| 14 | Domain returning IPv6 `fd00::1` / `::ffff:10.0.0.1` | BLOCKED_TARGET |
| 15 | Public target redirecting to `http://169.254.169.254/` | BLOCKED_TARGET (on hop) |
| 16 | Public target redirecting to a domain resolving private | BLOCKED_TARGET (on hop) |
| 17 | Redirect to `file:///` or `https://example.com:8080` | INVALID_URL (on hop) |
| 18 | Redirect chain of 6 hops / redirect loop | TARGET_UNREACHABLE (`TOO_MANY_REDIRECTS` detail logged only) |
| 19 | DNS rebinding: lookup #1 public, any later lookup private → socket must still hit pinned public IP (assert via mock that only one resolution occurred and connect used pinned address) | *accept*, pinned |
| 20 | Target that never sends headers | TARGET_TIMEOUT within budget + 500 ms |
| 21 | Target with 200 KB body | completes; body not buffered beyond limit |
| 22 | Header value containing `<script>` and bidi overrides | stored as text; UI test asserts no script execution and stripped bidi chars |
| 23 | `例え.jp` / `xn--` IDN | *accept*, normalized punycode |
| 24 | `example.com` (no scheme) | *accept*, `https://example.com/` |

Tests 12–21 run against **local** servers and a **mocked resolver** injected into `dns.ts` (dependency injection — the scanner accepts a `resolver` parameter for testing). No real network in automated tests.
