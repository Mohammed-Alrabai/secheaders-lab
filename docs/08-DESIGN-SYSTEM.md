# 08 — Design System

> Source of truth for the visual identity. It **supersedes** the colour and font notes in `06-UI-I18N-GUIDE.md` §1.
> The base is the user's shadcn/ui preset. Do not change the preset tokens; extend them only as described in §4.

## 1. shadcn/ui preset

| Setting | Value |
|---|---|
| Preset code | `b3JA2ZBtnk` |
| Style | Rhea |
| Base colour | Taupe |
| Theme / Chart colour | Sky / Sky |
| Heading font | JetBrains Mono |
| Body font | Oxanium |
| Icon library | Lucide |
| Radius | Small (`--radius: 0.45rem`) |
| Menu | Default / Solid · Menu accent: Subtle |
| Flags | `--template next --rtl --pointer` |

**Init command (Phase 0, single app, see ADR-007):**
```
pnpm dlx shadcn@latest init --preset b3JA2ZBtnk --template next --rtl --pointer
```
The user's original command included `--monorepo`. It is **intentionally dropped** (ADR-007). Before running, check `pnpm dlx shadcn@latest init --help` to confirm the flags. If the CLI asks for a project name, use the `.scaffold-tmp` method from `07` Phase 0.3. After init, compare the generated `globals.css` tokens with §2: they must match exactly.

## 2. Colour tokens (from the preset, keep verbatim)

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.147 0.004 49.3);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.147 0.004 49.3);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.147 0.004 49.3);
  --primary: oklch(0.5 0.134 242.749);
  --primary-foreground: oklch(0.977 0.013 236.62);
  --secondary: oklch(0.967 0.001 286.375);
  --secondary-foreground: oklch(0.21 0.006 285.885);
  --muted: oklch(0.96 0.002 17.2);
  --muted-foreground: oklch(0.547 0.021 43.1);
  --accent: oklch(0.96 0.002 17.2);
  --accent-foreground: oklch(0.214 0.009 43.1);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0.005 34.3);
  --input: oklch(0.922 0.005 34.3);
  --ring: oklch(0.714 0.014 41.2);
  --chart-1: oklch(0.828 0.111 230.318);
  --chart-2: oklch(0.685 0.169 237.323);
  --chart-3: oklch(0.588 0.158 241.966);
  --chart-4: oklch(0.5 0.134 242.749);
  --chart-5: oklch(0.443 0.11 240.79);
  --radius: 0.45rem;
  --sidebar: oklch(0.986 0.002 67.8);
  --sidebar-foreground: oklch(0.147 0.004 49.3);
  --sidebar-primary: oklch(0.588 0.158 241.966);
  --sidebar-primary-foreground: oklch(0.977 0.013 236.62);
  --sidebar-accent: oklch(0.96 0.002 17.2);
  --sidebar-accent-foreground: oklch(0.214 0.009 43.1);
  --sidebar-border: oklch(0.922 0.005 34.3);
  --sidebar-ring: oklch(0.714 0.014 41.2);
}

.dark {
  --background: oklch(0.147 0.004 49.3);
  --foreground: oklch(0.986 0.002 67.8);
  --card: oklch(0.214 0.009 43.1);
  --card-foreground: oklch(0.986 0.002 67.8);
  --popover: oklch(0.214 0.009 43.1);
  --popover-foreground: oklch(0.986 0.002 67.8);
  --primary: oklch(0.443 0.11 240.79);
  --primary-foreground: oklch(0.977 0.013 236.62);
  --secondary: oklch(0.274 0.006 286.033);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.268 0.011 36.5);
  --muted-foreground: oklch(0.714 0.014 41.2);
  --accent: oklch(0.268 0.011 36.5);
  --accent-foreground: oklch(0.986 0.002 67.8);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.547 0.021 43.1);
  --chart-1: oklch(0.828 0.111 230.318);
  --chart-2: oklch(0.685 0.169 237.323);
  --chart-3: oklch(0.588 0.158 241.966);
  --chart-4: oklch(0.5 0.134 242.749);
  --chart-5: oklch(0.443 0.11 240.79);
  --sidebar: oklch(0.214 0.009 43.1);
  --sidebar-foreground: oklch(0.986 0.002 67.8);
  --sidebar-primary: oklch(0.685 0.169 237.323);
  --sidebar-primary-foreground: oklch(0.293 0.066 243.157);
  --sidebar-accent: oklch(0.268 0.011 36.5);
  --sidebar-accent-foreground: oklch(0.986 0.002 67.8);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.547 0.021 43.1);
}
```

Hex equivalents (use them **only** where OKLCH is not supported, e.g. SVG assets, OG images, emails):

| Token | Hex |
|---|---|
| primary (light) | `#0069a8` |
| primary (dark) | `#00598a` |
| primary-foreground | `#f0f9ff` |
| chart-1 / brand accent | `#74d4ff` |
| chart-2 | `#00a6f4` |
| chart-3 | `#0084d1` |
| foreground (light) / background (dark) | `#0c0a09` |
| foreground (dark) | `#fbfaf9` |
| muted-foreground (light) | `#7c6d67` |
| border (light) | `#e8e4e3` |
| destructive (light) | `#e7000b` |

## 3. Typography

| Role | Latin | Arabic (`:lang(ar)`) | Weights |
|---|---|---|---|
| Body / UI (`--font-sans`) | **Oxanium** | **IBM Plex Sans Arabic** | 400, 500, 600 |
| Headings, card titles, labels in caps (`--font-heading`) | **JetBrains Mono** | **Changa** | 500, 600, 700 |
| Code, header values, URLs, scores (`--font-mono`) | **JetBrains Mono** | — (code is always LTR Latin) | 400, 500 |

- Oxanium and JetBrains Mono have **no Arabic glyphs**. The Arabic fonts are chosen to match their style: **Changa** has the same squared, technical shapes as Oxanium for headings, and **IBM Plex Sans Arabic** is easy to read in long text (ADR-008).
- Load all fonts with `next/font/google` (self-hosted at build time, so there are no requests to third parties at runtime, which our CSP needs). Subsets: `latin` for Oxanium and JetBrains Mono; `arabic` + `latin` for Changa and IBM Plex Sans Arabic. `display: 'swap'`.
- Switch font variables by locale in `layout.tsx` (set the CSS variables on `<html>` according to `lang`). Do not rely on browser font fallback.
- Numbers and scores: `font-variant-numeric: tabular-nums`, `--font-mono`, in both locales.
- Type scale (rem): 0.75 · 0.875 · 1 (body) · 1.125 · 1.25 · 1.5 · 2 · 3 (grade letter on results: 4–5 rem, `--font-heading`, weight 700).
- Arabic line-height ≥ 1.7 for paragraphs; Latin 1.6.

## 4. Extended semantic tokens (add to `globals.css` after the preset block)

The preset has no tokens for success, warning or grades. Add these and map them in `@theme inline` so Tailwind utilities exist (`bg-success`, `text-grade-a` …). Do not reuse `chart-*` for status, because charts and status mean different things.

```css
:root {
  --success: oklch(0.596 0.145 163.225);
  --success-foreground: oklch(0.979 0.021 166.113);
  --warning: oklch(0.769 0.188 70.08);
  --warning-foreground: oklch(0.279 0.077 45.635);
  --info: var(--primary);
  --info-foreground: var(--primary-foreground);

  --grade-a-plus: oklch(0.527 0.154 150.069);
  --grade-a: oklch(0.627 0.194 149.214);
  --grade-b: oklch(0.648 0.2 131.684);
  --grade-c: oklch(0.769 0.188 70.08);
  --grade-d: oklch(0.646 0.222 41.116);
  --grade-f: var(--destructive);
}
.dark {
  --success: oklch(0.696 0.17 162.48);
  --success-foreground: oklch(0.262 0.051 172.552);
  --warning: oklch(0.828 0.189 84.429);
  --warning-foreground: oklch(0.279 0.077 45.635);
  --grade-a-plus: oklch(0.723 0.219 149.579);
  --grade-a: oklch(0.792 0.209 151.711);
  --grade-b: oklch(0.841 0.238 128.85);
  --grade-c: oklch(0.828 0.189 84.429);
  --grade-d: oklch(0.75 0.183 55.934);
}
```

Usage rules:
- **Grade badge (large, ≥ 48 px letter):** solid `bg-grade-*` with white text (light theme) or `--background` text (dark theme). Exception: grade C uses `--warning-foreground` text in both themes (ADR-016). Contrast must be ≥ 3:1 (large-text rule).
- **Small chips, status pills, severity labels:** "soft" style, meaning a background of `color-mix(in oklch, var(--token) 14%, transparent)`, with text in the same hue, darker in light mode and lighter in dark mode. Contrast must be ≥ 4.5:1.
- Status mapping: pass → success · warn → warning · fail → destructive · info → info (primary).
- Severity mapping: critical/high → destructive · medium → warning · low → muted-foreground · info → info.
- Never use colour alone. Always pair it with an icon (Lucide `CircleCheck`, `TriangleAlert`, `CircleX`, `Info`) and text.
- **Automated check:** add a unit test that computes WCAG contrast for every pairing above, in both themes (convert OKLCH to sRGB in the test). The build fails if any pair falls below its threshold.

## 5. Shape, spacing, elevation

- Radius: the preset `--radius` (0.45rem) and its derived `sm/md/lg/xl`. Do not use other radius values. Pills/badges use `rounded-md`, not full pills.
- Spacing: Tailwind 4-px scale. Card padding `p-5`/`p-6`, page gutter `px-4` (mobile) / `px-6`.
- Elevation: borders first (`border` token), shadows minimal (`shadow-xs`) as in the Rhea style. No glows, no heavy gradients.
- Max content width `max-w-6xl`. Results page: 12-column grid on desktop, single column below `md`.

## 6. Components (shadcn/ui)

Install only what the UI needs:
`button`, `input`, `label`, `card`, `badge`, `tabs`, `collapsible` (or `accordion`), `tooltip`, `separator`, `skeleton`, `alert`, `dropdown-menu` (language + theme menus), `table`, `scroll-area`, `progress`, `sonner` (copy confirmations).

Rules:
- Components live in `src/components/ui/` (shadcn default) and stay close to their generated code. Product components in `src/components/` wrap them.
- `--rtl`: verify each component in Arabic, especially tabs arrow keys, dropdown alignment and toast position.
- `--pointer`: interactive elements show `cursor: pointer`. Keep it.
- Theme: **do not add `next-themes`**. The theme is resolved on the server from a cookie (`06` §1) and the `dark` class is set on `<html>` during SSR, so no inline script is needed and the CSP stays strict.

## 7. Iconography

- Lucide only, `strokeWidth={1.75}`, size 16 (inline) / 20 (buttons) / 24 (feature tiles).
- Category icons: Headers `FileCode2`, TLS `LockKeyhole`, Cookies `Cookie`, Disclosure `EyeOff`, Redirects `Route`, Report `Printer`, Copy `Copy`/`Check`, Language `Languages`, Theme `SunMoon`.
- Direction-sensitive icons (`ChevronRight`, `ArrowRight`) get `rtl:rotate-180`.

## 8. Logo

Files in `assets/brand/` (move them to `public/brand/` in Phase 0; copy `favicon.svg` to `src/app/icon.svg`):

| File | Use |
|---|---|
| `logo-horizontal-light.svg` / `-dark.svg` | Site header, README, social cards |
| `logo-stacked-light.svg` / `-dark.svg` | About page, print report cover, square placements |
| `logo-mark-light.svg` / `-dark.svg` | Avatar, small spaces, GitHub social preview |
| `favicon.svg` | Favicon (switches colours automatically via `prefers-color-scheme`) |
| `logo-preview.png` | Review image only, do not ship |

Construction:
- **Mark:** a shield with cut corners (echoing Oxanium's cut-corner letters), holding three "header lines" of decreasing length. The last one is accented with a check mark, which reads as "headers → verified".
- **Wordmark:** "SecHeaders" in Oxanium Bold, "Lab" in JetBrains Mono Medium in the brand colour. The text is converted to outlines (vector paths), so the logo renders the same everywhere without any font files.
- Colours: light uses primary `#0069a8`, lines `#f0f9ff`, accent `#74d4ff`. Dark uses chart-2 `#00a6f4` for the shield, `#0c0a09` for the lines, and `#74d4ff` for "Lab".
- Clear space: at least the height of one header line (≈ 1/12 of the mark height) on all sides. Minimum size: mark 16 px, horizontal logo 120 px wide.
- Do not: recolour outside the palette, stretch, add shadows or gradients, rebuild the text in a live font, or translate the product name. The name stays "SecHeaders Lab" in both locales. The Arabic UI may show a subtitle such as «مختبر فحص رؤوس الأمان» in Changa next to it, but never replaces it.
- In React: render the SVG with `next/image` (static import) or as an inline component converted from the file. Give it `alt="SecHeaders Lab"` and set its height in CSS.

## 9. Open Graph image

Phase 5: create `src/app/[locale]/opengraph-image.tsx` (1200×630). Background `#0c0a09`, horizontal dark logo, tagline in the locale ("Passive website security review" / «فحص أمني سلبي للمواقع»), Arabic set in Changa. Fonts must be loaded from local files bundled at build time.
