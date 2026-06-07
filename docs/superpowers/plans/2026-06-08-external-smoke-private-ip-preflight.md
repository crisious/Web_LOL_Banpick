# External Smoke Private IP Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent manual external smoke runs from targeting private or local network IP literals.

**Architecture:** Extend the existing `scripts/validate-external-smoke-url.mjs` preflight validator. It still accepts normal external HTTPS hostnames, but rejects IPv4/IPv6 literals that cannot be treated as public demo URLs.

**Tech Stack:** Node 20 ESM, existing zero-dependency validator tests, README/runbook documentation.

---

### Task 1: Validator Private Network Contract

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`
- Modify: `scripts/validate-external-smoke-url.mjs`

- [x] **Step 1: Write failing private IP tests**

Add validator tests for:

```js
https://10.0.0.5
https://172.16.0.1
https://172.31.255.255
https://192.168.1.10
https://169.254.1.1
https://100.64.0.1
https://0.0.0.0
https://[fc00::1]
https://[fd12::1]
https://[fe80::1]
```

Each should throw:

```text
external_readonly_url must not point to a local or private network target
```

Keep `https://demo.example.com/path` accepted.

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: tests for private IP literals fail because the validator currently rejects only localhost/loopback.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` reported 12 passed / 14 failed because localhost/loopback still used the old message and private IP literals were accepted.

- [x] **Step 3: Implement private IP detection**

Add helper functions inside `scripts/validate-external-smoke-url.mjs`:

```js
function isPrivateOrLocalIpv4(host) { ... }
function isPrivateOrLocalIpv6(host) { ... }
function isLocalOrPrivateHost(host) { ... }
```

Reject localhost, `.localhost`, loopback, unspecified, link-local, RFC1918 IPv4, carrier-grade NAT `100.64.0.0/10`, IPv6 loopback, IPv6 unique-local `fc00::/7`, and IPv6 link-local `fe80::/10`.

- [x] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: validator tests pass.

Observed: validator tests reported 26 passed / 0 failed.

### Task 2: Docs, QA, Push

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document private/internal IP rejection**

Document that manual external smoke URL preflight rejects private/internal network IP targets in addition to localhost/loopback.

Observed: `README.md` and `docs/external-demo-runbook.md` now document private/internal IP target rejection in manual external URL preflight.

- [x] **Step 2: Run full verification**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
npm test
git diff --check
```

Expected: all commands exit 0.

Observed: syntax check exited 0, validator tests reported 26 passed / 0 failed, `npm test` reported 580 passed / 0 failed across 24 test files, and `git diff --check` exited 0.

- [x] **Step 3: Commit, push, and verify remote QA**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-private-ip-preflight.md
git commit -m "ci: reject private external smoke targets"
git push origin main
gh run watch <run-id> --exit-status
```

Expected: push-triggered `QA` passes; external validation steps remain skipped on push events.

Observed: commit `d97926d` pushed to `origin/main`; remote `QA` run `27099083308` passed. Push-triggered external URL validation and external smoke steps were skipped as expected. Artifact `qa-automation-27099083308` included `qa-summary.json`, readonly `smoke-report.json`, and readonly `smoke-run.json`; summary reported 150 passed / 0 failed and sensitive pattern search found no matches.
