# Trust Proxy X-Forwarded-For Empty Segment Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent `TRUST_PROXY=1` rate-limit IP selection from normalizing malformed `x-forwarded-for` values that contain empty comma segments.

**Architecture:** Keep valid comma-separated `x-forwarded-for` values working. Treat non-empty `x-forwarded-for` strings with leading, trailing, or middle empty segments as ambiguous and fall back to `req.socket.remoteAddress`. Preserve duplicate header fallback and normal `cf-connecting-ip` / `x-real-ip` behavior.

**Tech Stack:** Node.js CommonJS server, extracted-function `.mjs` regression tests, README/runbook documentation, GitHub Actions QA workflow.

---

### Task 1: Add RED Coverage For Empty X-Forwarded-For Segments

**Files:**
- Modify: `test-artifacts/server/trust-proxy-tests.mjs`

- [x] **Step 1: Add failing malformed XFF checks**

Insert these checks after the existing `exact TRUST_PROXY rejects duplicate x-forwarded-for values` check:

```js
check("exact TRUST_PROXY rejects leading empty x-forwarded-for segment",
  exactProxy.getClientIp(makeReq({
    headers: { "x-forwarded-for": ", 198.51.100.12" },
    remoteAddress: "203.0.113.10",
  })),
  "203.0.113.10");

check("exact TRUST_PROXY rejects trailing empty x-forwarded-for segment",
  exactProxy.getClientIp(makeReq({
    headers: { "x-forwarded-for": "198.51.100.13," },
    remoteAddress: "203.0.113.10",
  })),
  "203.0.113.10");

check("exact TRUST_PROXY rejects middle empty x-forwarded-for segment",
  exactProxy.getClientIp(makeReq({
    headers: { "x-forwarded-for": "198.51.100.14, , 198.51.100.15" },
    remoteAddress: "203.0.113.10",
  })),
  "203.0.113.10");
```

- [x] **Step 2: Run focused RED test**

Run:

```bash
node test-artifacts/server/trust-proxy-tests.mjs
```

Expected before implementation: exit `1`; existing checks pass, and the three new malformed XFF checks fail because current parsing filters out empty comma segments.

Observed: RED confirmed. Trust proxy tests reported `13 passed, 3 failed`; leading, trailing, and middle empty `x-forwarded-for` segments were filtered out and the first remaining value was trusted.

### Task 2: Implement X-Forwarded-For Empty Segment Fallback

**Files:**
- Modify: `server.js`

- [x] **Step 1: Tighten XFF parsing in `getClientIp()`**

Replace the current `x-forwarded-for` parsing block with:

```js
  const forwardedForHeader = proxyHeaderValue(req.headers["x-forwarded-for"]);
  if (forwardedForHeader.duplicate) return req.socket.remoteAddress || "unknown";
  const forwardedForRaw = forwardedForHeader.value;
  const forwardedForParts = forwardedForRaw.split(",").map((part) => part.trim());
  if (forwardedForRaw.trim() && forwardedForParts.some((part) => part === "")) {
    return req.socket.remoteAddress || "unknown";
  }
  const forwardedFor = forwardedForParts.filter(Boolean);
  if (forwardedFor.length > 0) return forwardedFor[0];
```

- [x] **Step 2: Run focused GREEN test**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/trust-proxy-tests.mjs &&
node test-artifacts/server/trust-proxy-tests.mjs
```

Expected after implementation: exit `0`, trust proxy tests report `16 passed, 0 failed`.

Observed: GREEN confirmed. Syntax checks for `server.js` and `test-artifacts/server/trust-proxy-tests.mjs` passed; trust proxy tests reported `16 passed, 0 failed`.

### Task 3: Document Malformed XFF Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-trust-proxy-xff-empty-segment-guard.md`

- [x] **Step 1: Update proxy trust documentation**

In `README.md` and `docs/external-demo-runbook.md`, update the `TRUST_PROXY` paragraph to state that non-empty `x-forwarded-for` values with leading, trailing, or middle empty comma segments are treated as malformed and fall back to the socket IP for rate-limit selection.

- [x] **Step 2: Scan plan placeholders**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-trust-proxy-xff-empty-segment-guard.md
```

Expected: exit `1`, no placeholder matches.

Observed: Placeholder scan exited `1`, no matches.

### Task 4: Full QA, Commit, Push, And Remote Evidence

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-trust-proxy-xff-empty-segment-guard.md`
- Modify: `server.js`
- Modify: `test-artifacts/server/trust-proxy-tests.mjs`

- [x] **Step 1: Run local QA**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/trust-proxy-tests.mjs &&
node test-artifacts/server/trust-proxy-tests.mjs &&
npm test &&
git diff --check
```

Expected: exit `0`; focused tests report `16 passed, 0 failed`; full suite reports `1020 passed, 0 failed across 32 test file(s)`.

Observed: Local QA exited `0`. Placeholder scan exited `1`; syntax checks passed; trust proxy tests reported `16 passed, 0 failed`; `npm test` reported `1020 passed, 0 failed across 32 test file(s)`; `git diff --check` passed.

- [ ] **Step 2: Commit and push**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-trust-proxy-xff-empty-segment-guard.md server.js test-artifacts/server/trust-proxy-tests.mjs
git diff --cached --check
git commit -m "ci: reject malformed forwarded-for headers"
git push origin main
```

Expected: commit succeeds on `main`, push advances `origin/main`.

- [ ] **Step 3: Verify GitHub Actions artifact**

Run:

```bash
gh run list --repo crisious/Web_LOL_Banpick --branch main --limit 5
gh run watch <run-id> --repo crisious/Web_LOL_Banpick --exit-status
gh run view <run-id> --repo crisious/Web_LOL_Banpick --json databaseId,headSha,headBranch,status,conclusion,url,jobs
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Expected: newest run for the pushed commit succeeds, and the uploaded `qa-automation-<run-id>` artifact contains read-only smoke evidence with `155 passed / 0 failed`.

- [ ] **Step 4: Update Obsidian project note**

Append a QA log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local RED/GREEN/full QA, remote run URL, artifact id, artifact smoke count, sensitive scan result, and final `main...origin/main` sync count.
