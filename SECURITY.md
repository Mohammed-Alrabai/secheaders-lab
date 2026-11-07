# Security Policy

SecHeaders Lab fetches URLs that users submit, so its own security matters. Reports are welcome and taken
seriously.

## Supported versions

| Version | Supported |
|---|---|
| Latest release on `main` | Yes |
| Older releases | No |

## Reporting a vulnerability

Please **do not** open a public issue, discussion or pull request for a security problem.

Report it privately through GitHub: open the repository's **Security** tab and choose
**[Report a vulnerability](../../security/advisories/new)**. This creates a private advisory that only the
maintainer can see.

Please include:

- what the issue is and where (URL, file or component);
- steps to reproduce, with a minimal proof of concept;
- the impact you expect (for example: reaching an internal address, bypassing a control, script injection).

## What to expect

- Acknowledgement within **5 business days**.
- An initial assessment and, if confirmed, a fix plan within **14 days**.
- Credit in the advisory and the changelog, if you want it.

This is a personal open-source project maintained in spare time, so these are targets, not guarantees.

## Scope

In scope:

- The SecHeaders Lab application and its API (`/api/scan`).
- Server-side request forgery: any way to make the scanner connect to a private, loopback, link-local or
  otherwise non-public address, or to a port other than 80/443 (see
  [docs/03-SECURITY-CONTROLS.md](docs/03-SECURITY-CONTROLS.md)).
- Script or markup injection through data returned by a scanned site.
- Weaknesses in the site's own security headers or Content-Security-Policy.
- Secrets or sensitive data in the repository or build output.

Out of scope:

- Grades or findings you disagree with for a site you scanned. Please open a normal issue for those.
- Volumetric denial of service, or findings that need a large number of requests.
- Reports from automated scanners without a demonstrated impact.
- Vulnerabilities in third-party platforms (GitHub, Netlify) — report those to the vendor.

## Testing rules

- Test only against the public demo or your own local copy. Do not use SecHeaders Lab to probe sites you are
  not authorized to assess.
- Stay within the rate limit; do not degrade the service for others.
- Do not access, change or delete data that is not yours.

Good-faith research that follows these rules will not lead to any complaint from the maintainer.
