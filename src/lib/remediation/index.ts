import type { RuleId } from '../scanner/types'

/** Server platforms with copy-ready fixes (PRD §5). */
export const PLATFORMS = ['nginx', 'apache', 'iis', 'nextjs', 'netlify', 'cloudflare'] as const
export type Platform = (typeof PLATFORMS)[number]

export type Snippet =
  | {
      kind: 'code'
      language: 'nginx' | 'apache' | 'xml' | 'ts' | 'text'
      filename: string
      code: string
    }
  /** Prose steps (dashboards, host-managed settings); text lives in `messages/*.json`. */
  | { kind: 'instructions'; messageKey: string }

/**
 * Recommended secure baselines (`02` §3 remediation). CSP must be tailored per site; the
 * snippet says so. Permissions-Policy omits the obsolete `interest-cohort` (T-5).
 */
export const RECOMMENDED_HEADERS = {
  'HDR-HSTS': ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'],
  'HDR-CSP': [
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  ],
  'HDR-FRAME': ['X-Frame-Options', 'DENY'],
  'HDR-XCTO': ['X-Content-Type-Options', 'nosniff'],
  'HDR-REFERRER': ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  'HDR-PERMISSIONS': [
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  ],
  'HDR-COOP': ['Cross-Origin-Opener-Policy', 'same-origin'],
  'HDR-XXSS': ['X-XSS-Protection', '0'],
} as const satisfies Partial<Record<RuleId, readonly [string, string]>>

const HEADER_MAP: ReadonlyMap<string, readonly [string, string]> = new Map(
  Object.entries(RECOMMENDED_HEADERS),
)

const HEADER_NOTES: ReadonlyMap<string, string> = new Map([
  ['HDR-HSTS', 'Keep "preload" only if you will submit the domain to the HSTS preload list.'],
  [
    'HDR-CSP',
    'Tailor the sources to your site; deploy as Content-Security-Policy-Report-Only first.',
  ],
  ['HDR-FRAME', "CSP frame-ancestors 'none' is the modern equivalent; sending both is fine."],
  ['HDR-XXSS', 'The XSS auditor is obsolete; "0" disables it in legacy browsers. Rely on CSP.'],
])

const code = (
  language: Extract<Snippet, { kind: 'code' }>['language'],
  filename: string,
  lines: string[],
): Snippet => ({ kind: 'code', language, filename, code: `${lines.join('\n')}\n` })

const steps = (platform: Platform, rule: RuleId): Snippet => ({
  kind: 'instructions',
  messageKey: `remediation.${platform}.${rule}`,
})

function headerSnippet(
  rule: RuleId,
  [name, value]: readonly [string, string],
  platform: Platform,
): Snippet {
  const note = HEADER_NOTES.get(rule)
  switch (platform) {
    case 'nginx':
      return code('nginx', 'nginx.conf (server block)', [
        ...(note ? [`# ${note}`] : []),
        `add_header ${name} "${value}" always;`,
      ])
    case 'apache':
      return code('apache', '.htaccess or VirtualHost (mod_headers)', [
        ...(note ? [`# ${note}`] : []),
        `Header always set ${name} "${value}"`,
      ])
    case 'iis':
      return code('xml', 'web.config', [
        ...(note ? [`<!-- ${note} -->`] : []),
        '<system.webServer>',
        '  <httpProtocol>',
        '    <customHeaders>',
        `      <add name="${name}" value="${value.replaceAll('"', '&quot;')}" />`,
        '    </customHeaders>',
        '  </httpProtocol>',
        '</system.webServer>',
      ])
    case 'nextjs':
      return code('ts', 'next.config.ts', [
        ...(note ? [`// ${note}`] : []),
        'const nextConfig = {',
        '  async headers() {',
        '    return [',
        '      {',
        "        source: '/:path*',",
        `        headers: [{ key: '${name}', value: ${JSON.stringify(value)} }],`,
        '      },',
        '    ]',
        '  },',
        '}',
        '',
        'export default nextConfig',
      ])
    case 'netlify':
      return code('text', '_headers', [...(note ? [`# ${note}`] : []), '/*', `  ${name}: ${value}`])
    case 'cloudflare':
      return steps('cloudflare', rule)
    default: {
      const exhaustive: never = platform
      throw new Error(`Unknown platform: ${String(exhaustive)}`)
    }
  }
}

const COOKIE_RULES = new Set<RuleId>(['CK-SECURE', 'CK-HTTPONLY', 'CK-SAMESITE'])

function cookieSnippet(rule: RuleId, platform: Platform): Snippet {
  switch (platform) {
    case 'nginx':
      return code('nginx', 'nginx.conf (location proxying to the app, nginx >= 1.19.3)', [
        'proxy_cookie_flags ~ secure httponly samesite=lax;',
      ])
    case 'apache':
      return code('apache', 'VirtualHost (mod_headers)', [
        '# Prefer setting these flags in the application; this rewrites every cookie.',
        'Header always edit Set-Cookie ^(.*)$ "$1; Secure; HttpOnly; SameSite=Lax"',
      ])
    case 'iis':
      return code('xml', 'web.config (ASP.NET)', [
        '<system.web>',
        '  <httpCookies requireSSL="true" httpOnlyCookies="true" sameSite="Lax" />',
        '</system.web>',
      ])
    case 'nextjs':
      return code('ts', 'Route Handler or Server Action', [
        "import { cookies } from 'next/headers'",
        '',
        'const store = await cookies()',
        "store.set('session', value, { secure: true, httpOnly: true, sameSite: 'lax', path: '/' })",
      ])
    case 'netlify':
    case 'cloudflare':
      return steps(platform, rule)
    default: {
      const exhaustive: never = platform
      throw new Error(`Unknown platform: ${String(exhaustive)}`)
    }
  }
}

function otherSnippet(rule: RuleId, platform: Platform): Snippet {
  const key = `${rule}:${platform}`
  switch (key) {
    case 'TLS-PROTOCOL:nginx':
      return code('nginx', 'nginx.conf (server block)', ['ssl_protocols TLSv1.2 TLSv1.3;'])
    case 'TLS-PROTOCOL:apache':
      return code('apache', 'ssl.conf or VirtualHost', ['SSLProtocol -all +TLSv1.2 +TLSv1.3'])
    case 'TLS-HTTP-REDIRECT:nginx':
      return code('nginx', 'nginx.conf', [
        'server {',
        '    listen 80;',
        '    listen [::]:80;',
        '    server_name example.com www.example.com;',
        '    return 301 https://$host$request_uri;',
        '}',
      ])
    case 'TLS-HTTP-REDIRECT:apache':
      return code('apache', '.htaccess or VirtualHost *:80 (mod_rewrite)', [
        'RewriteEngine On',
        'RewriteCond %{HTTPS} off',
        'RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]',
      ])
    case 'TLS-HTTP-REDIRECT:iis':
      return code('xml', 'web.config (URL Rewrite module)', [
        '<system.webServer>',
        '  <rewrite>',
        '    <rules>',
        '      <rule name="HTTPS redirect" stopProcessing="true">',
        '        <match url="(.*)" />',
        '        <conditions><add input="{HTTPS}" pattern="off" /></conditions>',
        '        <action type="Redirect" url="https://{HTTP_HOST}/{R:1}" redirectType="Permanent" />',
        '      </rule>',
        '    </rules>',
        '  </rewrite>',
        '</system.webServer>',
      ])
    case 'CK-PREFIX:nextjs':
      return code('ts', 'Route Handler or Server Action', [
        "import { cookies } from 'next/headers'",
        '',
        '// __Host- requires Secure, Path=/ and no Domain attribute.',
        'const store = await cookies()',
        "store.set('__Host-session', value, { secure: true, httpOnly: true, sameSite: 'lax', path: '/' })",
      ])
    case 'INF-SERVER:nginx':
      return code('nginx', 'nginx.conf (http block)', ['server_tokens off;'])
    case 'INF-SERVER:apache':
      return code('apache', 'apache2.conf / httpd.conf', [
        'ServerTokens Prod',
        'ServerSignature Off',
      ])
    case 'INF-SERVER:iis':
      return code('xml', 'web.config (IIS 10+)', [
        '<system.webServer>',
        '  <security>',
        '    <requestFiltering removeServerHeader="true" />',
        '  </security>',
        '</system.webServer>',
      ])
    case 'INF-POWERED-BY:nginx':
      return code('nginx', 'nginx.conf', [
        'proxy_hide_header X-Powered-By;',
        'fastcgi_hide_header X-Powered-By;',
      ])
    case 'INF-POWERED-BY:apache':
      return code('apache', 'VirtualHost (mod_headers)', [
        'Header always unset X-Powered-By',
        'Header unset X-Powered-By',
      ])
    case 'INF-POWERED-BY:iis':
      return code('xml', 'web.config', [
        '<system.webServer>',
        '  <httpProtocol>',
        '    <customHeaders>',
        '      <remove name="X-Powered-By" />',
        '    </customHeaders>',
        '  </httpProtocol>',
        '</system.webServer>',
      ])
    case 'INF-POWERED-BY:nextjs':
      return code('ts', 'next.config.ts', [
        'const nextConfig = {',
        '  poweredByHeader: false,',
        '}',
        '',
        'export default nextConfig',
      ])
    case 'INF-ASPNET:iis':
      return code('xml', 'web.config (ASP.NET)', [
        '<system.web>',
        '  <httpRuntime enableVersionHeader="false" />',
        '</system.web>',
        '<!-- ASP.NET MVC: also set MvcHandler.DisableMvcResponseHeader = true in Application_Start. -->',
      ])
    default:
      return steps(platform, rule)
  }
}

/** The fix for a rule on a platform: copy-ready config or a key for localized steps. */
export function remediationFor(rule: RuleId, platform: Platform): Snippet {
  const header = HEADER_MAP.get(rule)
  if (header) return headerSnippet(rule, header, platform)
  if (COOKIE_RULES.has(rule)) return cookieSnippet(rule, platform)
  return otherSnippet(rule, platform)
}
