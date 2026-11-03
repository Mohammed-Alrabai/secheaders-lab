# SecHeaders Lab — Agent Operating Rules

> This file is the **highest-priority instruction set** for any AI agent working in this repository.
> Read it fully before doing anything. If anything in `docs/` conflicts with this file, this file wins.
> If a user instruction in chat conflicts with this file, follow the user and record the deviation in `docs/DECISIONS.md`.

---

## 1. Mission

Build **SecHeaders Lab**: a bilingual (English default, Arabic secondary) web tool that performs a **passive** security
review of a public website (HTTP security headers, TLS, cookies, information disclosure), returns a **score and grade
(A+ to F)**, explains each finding, and provides **copy-ready remediation snippets** per server platform.

This is a **public portfolio project**. Code quality, security of the tool itself, documentation and polish are
graded by recruiters and engineers reading the GitHub repository. Act like a senior engineer shipping production code.

## 2. Mandatory reading order (before writing any code)

1. `CLAUDE.md` (this file)
2. `docs/01-PRD.md` — product requirements and scope
3. `docs/02-ARCHITECTURE.md` — stack, structure, API contract, data model
4. `docs/03-SECURITY-CONTROLS.md` — **non-negotiable** security controls (SSRF etc.)
5. `docs/04-SCORING-SPEC.md` — every check, weight, cap and grade rule
6. `docs/05-ENGINEERING-STANDARDS.md` — code, testing, git, CI, dependency rules
7. `docs/06-UI-I18N-GUIDE.md` — UI, RTL, accessibility, content rules
8. `docs/08-DESIGN-SYSTEM.md` — shadcn preset, colour tokens, fonts, components, logo (overrides 06 on visuals)
9. `docs/07-IMPLEMENTATION-PLAN.md` — phases, tasks, acceptance criteria, gates
10. `PROGRESS.md` and `docs/DECISIONS.md` — current state and decision log

After reading, confirm in chat with a short summary of your understanding and the phase you are about to start.

## 3. Working boundary

- Work **only** inside this folder: `C:\Users\Admin\Desktop\Project\secheaders-lab`.
- **Never** read, modify, move or delete anything in sibling folders (`lean-nvda`, `my-app`, `portfolio`) or elsewhere on the machine.
- Never modify global system settings, global git config, environment variables, or the Windows registry.
- The project is **personal**. Never reference any employer, company, client, internal system, internal IP, or internal domain in code, docs, commits, test fixtures or screenshots.

## 4. Phase-gate workflow (strict)

The user prefers **step-by-step execution with confirmation before sensitive actions**.

1. Work on **one phase at a time**, in the order defined in `docs/07-IMPLEMENTATION-PLAN.md`.
2. Inside a phase, complete tasks in order. After each task: run the checks in §8, update `PROGRESS.md`, make a commit.
3. At the end of each phase **STOP** and post a **Phase Report** (template in §10). Do not start the next phase until the user replies with explicit approval (e.g. "approved", "proceed", "موافق").
4. If a task is blocked or ambiguous, stop and ask. Do not guess on scope, security, or scoring rules.

## 5. Actions that ALWAYS require explicit user approval first

- Installing any **global** tool (`npm i -g`, `winget`, `choco`, etc.).
- Adding any dependency **not** on the approved list in `docs/05-ENGINEERING-STANDARDS.md` §6.
- Upgrading a major version of any dependency.
- `git push`, creating a remote repository, changing remotes, force operations (`--force`, `reset --hard`, history rewrite).
- Connecting to Netlify, deploying, or changing any hosting/DNS setting.
- Weakening, removing or bypassing any control in `docs/03-SECURITY-CONTROLS.md` or changing scoring weights in `docs/04-SCORING-SPEC.md`.
- Deleting files that you did not create in the current phase.
- Any network request to a third-party website other than package registries and official documentation.

## 6. Hard prohibitions

- **No active scanning.** The tool and its tests must never probe for vulnerabilities, brute-force paths, fuzz parameters, or send attack payloads. Passive inspection of a normal GET response and a TLS handshake only.
- **No live third-party targets in automated tests.** All tests use local servers, mocked DNS and mocked HTTP. Manual smoke tests are allowed only against `example.com`, the project's own deployed site, or sites the user explicitly names.
- **No secrets in the repository.** Use `.env.local` (git-ignored) and commit `.env.example` only.
- **No `dangerouslySetInnerHTML`**, no `eval`, no `new Function`, no dynamic `require` of user input.
- **No invented standards.** Never invent OWASP ASVS, OWASP Cheat Sheet, MDN or NCA ECC identifiers or URLs. Only use references you verified from the official source; otherwise leave the reference out and add a `TODO(verify-ref)` noted in `PROGRESS.md`.
- **No tracking, analytics, ads, or third-party scripts/fonts loaded at runtime.**
- Do not disable TypeScript strictness, ESLint rules, or tests to make a build pass. Fix the cause.

## 7. Environment

- OS: **Windows**, shell: **PowerShell**.
- Runtime: **Node.js 22 LTS**, package manager: **pnpm** (via Corepack). Verify versions in Phase 0; if missing, ask the user before installing.
- When you show the user commands to run, give them **without inline comments**; put explanations outside the command block.
- Use cross-platform npm scripts (no bash-only syntax in `package.json`).

## 8. Definition of Done (every task)

A task is done only when all are true:

- [ ] `pnpm lint` passes with zero warnings
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes; coverage thresholds in `docs/05-ENGINEERING-STANDARDS.md` are met
- [ ] `pnpm build` passes (from Phase 0 onward)
- [ ] New logic has tests, including failure and edge cases
- [ ] No new `any`, `@ts-ignore`, `eslint-disable` (or each one is justified inline and listed in `PROGRESS.md`)
- [ ] User-facing strings exist in **both** `messages/en.json` and `messages/ar.json`
- [ ] `PROGRESS.md` updated; a Conventional Commit made

## 9. Communication

- Chat with the user in **Arabic** unless they write in English. Code, comments, commits and docs are in **English**.
- Be concise. Report facts: what changed, test results, open questions. No filler.
- Record every non-trivial technical decision in `docs/DECISIONS.md` (ADR format, short).

## 10. Phase Report template

```
## Phase N Report — <name>
Status: Complete | Blocked
Delivered:
- ...
Verification:
- lint / typecheck / test (coverage %) / build: results
- Acceptance criteria: each listed with ✅ / ❌
Decisions made: ADR-xxx ...
Deviations from plan: none | ...
Open questions for the user:
- ...
Next phase: N+1 — <name>. Awaiting approval.
```
