# 06 — UI, Internationalization & Accessibility Guide

## 1. Design direction

> **Visual tokens, fonts, components and logo are defined in `08-DESIGN-SYSTEM.md`, which overrides any colour/font detail below.**

- Tone: **professional security tool** — calm, precise, trustworthy. Not "hacker" aesthetics (no matrix green, no skulls).
- Light and dark themes; follow `prefers-color-scheme`, manual toggle stored in a cookie (`theme`, `SameSite=Lax; Secure; Path=/`) — no `localStorage` flash: theme resolved server-side.
- Taupe neutral base with the Sky primary (preset). Grade colours come from the `--grade-*` tokens in `08` §4 (A+/A green · B lime · C amber · D orange · F red); never rely on colour alone, always show the letter.
- Status icons + text: pass ✓, warn !, fail ✕, info i.
- Typography: per `08` §3 (Oxanium / JetBrains Mono; Arabic IBM Plex Sans Arabic / Changa).
- Layout: max width ~1100 px, generous whitespace, cards with subtle borders, 8-px spacing scale.

## 2. Pages

### Home `/{locale}`
- Hero: product name, one-line value proposition, URL input with inline validation, "Scan" button, example chips (`example.com`, the site itself).
- Three feature tiles: Passive & safe · Fixes for your server · English & Arabic.
- Short "How it works" (3 steps) and link to methodology.
- Footer: disclaimer, privacy line, GitHub link, author LinkedIn link (URL provided by user in Phase 6), language switch.

### Results `/{locale}/scan?url=…`
1. **Summary header**: grade badge (large), score `/100`, target final URL (text, copy button), scan time, duration, buttons: Rescan · Share link (copy) · Print / PDF.
2. **Caps notice** if any cap applied (e.g. "Grade capped at B because CSP is missing").
3. **Summary counts**: pass / warn / fail / info.
4. **Findings grouped by category** (Headers, TLS, Cookies, Disclosure), sorted fail → warn → info → pass; pass items collapsed by default.
   Each finding card: status icon, title, severity chip, points deducted, evidence (monospace, LTR), expandable:
   - *Why it matters* (2–4 sentences)
   - *How to fix* — tabs: Nginx · Apache · IIS · Next.js · Netlify · Cloudflare; code block with copy button and a "copied" live-region announcement
   - *References* (external links, `rel="noopener noreferrer"`, `target="_blank"` with visible external icon)
5. **TLS details** panel: protocol, issuer, valid until (localized date), days remaining.
6. **Redirect chain** (plain text per SC-30).
7. **Raw headers** (collapsible table, monospace, LTR).

States: loading skeleton with step text ("Resolving…", "Connecting…", "Analyzing…" — cosmetic, time-based), each API error code with a friendly message and a retry action.

### About `/{locale}/about`
Methodology (render the checks and weights from `rules.ts`, not hand-written duplicates), grading & caps, limitations (passive only, single request, results can vary by geography/CDN), privacy, terms of use, standards references and the informational NCA ECC note.

### Print view
`@media print` styles on the results page: hide nav/buttons, expand all failing/warning findings, show first remediation tab only (user-selected platform), page header with product name + target + date, page numbers via CSS, avoid breaking cards across pages. Must look correct in Arabic.

## 3. Internationalization

- `next-intl` with locale prefix always (`/en`, `/ar`); `/` redirects by `Accept-Language` (fallback `en`).
- `<html lang="ar" dir="rtl">` for Arabic.
- Messages structure:
  ```json
  {
    "common": { … },
    "home": { … },
    "results": { … },
    "errors": { "INVALID_URL": "…", … },
    "rules": {
      "HDR-HSTS": {
        "title": "Strict-Transport-Security (HSTS)",
        "why": "…",
        "states": { "missing": "…", "short": "Max-age is {days} days; recommended ≥ 365.", "ok": "…" }
      }
    }
  }
  ```
- A unit test asserts `en.json` and `ar.json` have **identical key sets** and identical ICU placeholders.
- **Arabic quality**: Modern Standard Arabic, professional and clear. Keep technical terms (header names, `max-age`, CSP) in Latin script inside `<bdi>` / LTR spans. Do not machine-translate word-for-word; the user will review the Arabic copy at the end of Phase 4.
- Numbers: Western digits (0–9) in both locales for scores and technical values; dates localized via `Intl.DateTimeFormat` (Gregorian calendar).

## 4. RTL rules

- Use Tailwind logical utilities only: `ms-/me-`, `ps-/pe-`, `start-/end-`, `text-start/end`, `border-s/e`. Lint for physical `ml-/mr-/pl-/pr-/left-/right-` in components (simple ESLint `no-restricted-syntax` or review checklist).
- Icons that imply direction (arrows, chevrons) flip with `rtl:rotate-180`.
- Code blocks, URLs, header values, IPs: always `dir="ltr"` and `unicode-bidi: isolate`.
- Playwright visual check of home and results in both directions.

## 5. Accessibility (WCAG 2.2 AA)

- Semantic landmarks (`header`, `main`, `nav`, `footer`), one `h1` per page, logical heading order.
- Form: visible label, `aria-describedby` for errors, error summary on submit, focus moves to results heading when the scan completes (`aria-live="polite"` status during scanning).
- Tabs: WAI-ARIA tabs pattern with arrow-key navigation (respect RTL arrow direction).
- Disclosure widgets: `button` + `aria-expanded` + `aria-controls`.
- Visible focus ring on every interactive element; target size ≥ 24×24 px.
- Respect `prefers-reduced-motion`.
- axe-core in e2e: zero serious/critical violations on all pages, both locales, both themes.

## 6. SEO & sharing

- Per-locale metadata, `alternates.languages` (hreflang), canonical URLs.
- Open Graph / Twitter image (static, branded, EN and AR variants).
- `robots.ts`: allow `/`, disallow `/api/`. Results pages `noindex` (they depend on query).
- `sitemap.ts` with home + about per locale.
