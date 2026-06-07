# External Smoke Canonical IPv6 Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject parser-normalized IPv6 literal spellings in manual external smoke URLs before QA launches any external browser traffic.

**Architecture:** The existing zero-dependency validator already compares raw and parsed host spellings for IPv4 and raw DNS hostnames. This change extends the same raw-host comparison to IPv6 literals by comparing the bracketed raw host to Node's canonical parsed `hostname`.

**Tech Stack:** Node.js ES modules, existing hand-rolled validator tests, README/runbook documentation, GitHub Actions QA.

---

## File Structure

- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`
  - Adds two focused reject tests for expanded and zero-padded public IPv6 literal spellings.
- Modify: `scripts/validate-external-smoke-url.mjs`
  - Adds the raw IPv6 canonical spelling guard next to the existing IPv4 canonical guard.
- Modify: `README.md`
  - Documents that non-canonical IPv6 literal spelling is rejected.
- Modify: `docs/external-demo-runbook.md`
  - Mirrors the README external smoke URL preflight rule.
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-canonical-ipv6-preflight.md`
  - Records RED/GREEN/full QA/remote QA evidence as tasks complete.

### Task 1: Add Failing IPv6 Canonical Spelling Tests

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Add reject checks immediately after the existing public IPv6 accept check**

```js
  checkThrows("validateExternalSmokeUrl rejects expanded public IPv6 literal spelling",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[2001:4860:4860:0:0:0:0:8888]"),
    "external_readonly_url must use canonical IPv6 literal spelling");

  checkThrows("validateExternalSmokeUrl rejects zero-padded public IPv6 literal spelling",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[2001:4860:4860:0000:0000:0000:0000:8888]"),
    "external_readonly_url must use canonical IPv6 literal spelling");
```

- [x] **Step 2: Run focused validator tests and verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected:

```text
107 passed, 2 failed
```

The two new tests should fail because the current validator accepts parser-normalized IPv6 spellings and returns `https://[2001:4860:4860::8888]/`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` reported `107 passed, 2 failed`. The expanded and zero-padded public IPv6 literal checks failed because no error was thrown.

### Task 2: Reject Raw IPv6 Spellings That Node Normalizes

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`

- [x] **Step 1: Add the IPv6 raw host guard after the existing IPv4 canonical guard**

```js
function dottedIpv4MappedIpv6Parts(host) {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!normalized.startsWith("::ffff:")) return null;
  return ipv4Parts(normalized.slice("::ffff:".length));
}

  if (ipv4Parts(host) && rawHost !== host) {
    throw new Error(`${safeLabel} must use canonical dotted-decimal IPv4 literals`);
  }
  if (host.includes(":") && rawHost !== host && !dottedIpv4MappedIpv6Parts(rawHost)) {
    throw new Error(`${safeLabel} must use canonical IPv6 literal spelling`);
  }
```

- [x] **Step 2: Run focused validator tests and verify GREEN**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected:

```text
109 passed, 0 failed
```

Observed: the first guard attempt caught existing dotted IPv4-mapped IPv6 inputs too early, changing their expected private/reserved/public behavior. Root cause was that Node canonicalizes `https://[::ffff:8.8.8.8]` to `https://[::ffff:808:808]/`. The final guard exempts raw dotted IPv4-mapped IPv6 literals so existing mapped-address checks continue through the private/reserved/public IP classification path. `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` then reported `109 passed, 0 failed`.

### Task 3: Update Reader-Facing URL Rules

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Add IPv6 canonical spelling to both external smoke URL rule paragraphs**

In both files, extend the rejection list from:

```text
non-canonical IPv4 literal spelling
```

to:

```text
non-canonical IPv4 literal spelling, non-canonical IPv6 literal spelling
```

- [ ] **Step 2: Update the expected full test count in project records when full QA confirms it**

After full QA, record `670 passed, 0 failed across 24 test file(s)` in the Obsidian project log.

### Task 4: Full QA, Commit, Push, and Remote Artifact Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-canonical-ipv6-preflight.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local full QA**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected:

```text
109 passed, 0 failed
670 passed, 0 failed across 24 test file(s)
```

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` exited 0. Validator tests reported `109 passed, 0 failed`; the full suite reported `670 passed, 0 failed across 24 test file(s)`.

- [x] **Step 2: Commit and push implementation**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-canonical-ipv6-preflight.md
git commit -m "ci: reject normalized smoke ipv6 literals"
git push origin main
```

Observed: committed and pushed `263dbf2 ci: reject normalized smoke ipv6 literals` to `origin/main`.

- [x] **Step 3: Verify GitHub Actions QA artifact**

Run:

```bash
gh run list --workflow QA --branch main --limit 10 --json databaseId,headSha,status,conclusion,createdAt,url,event,name
gh run watch <run-id> --exit-status
gh run view <run-id> --json databaseId,headSha,status,conclusion,url
```

Expected:

```text
"conclusion": "success"
```

Observed: GitHub Actions QA run `27103545379` completed with conclusion `success` for head SHA `263dbf27df42f08aee044b8d2d0952801186806d`.

- [x] **Step 4: Download and scan the QA artifact**

Run:

```bash
tmp_dir=$(mktemp -d /tmp/lol-ai-coach-canonical-ipv6.XXXXXX)
gh run download <run-id> -n qa-automation-<run-id> -D "$tmp_dir"
find "$tmp_dir" -maxdepth 3 -type f | sort
sed -n '1,260p' "$tmp_dir/qa-summary.json"
rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@" "$tmp_dir" || true
```

Expected:

```text
150 passed / 0 failed
no sensitive scan matches
```

Observed: artifact `qa-automation-27103545379` / id `7467574445` downloaded to `/tmp/lol-ai-coach-canonical-ipv6.7HJRYy`. `qa-summary.json` recorded read-only smoke `150 passed / 0 failed`, and the sensitive scan returned no matches.

- [ ] **Step 5: Commit and push documentation evidence**

Run:

```bash
git add docs/superpowers/plans/2026-06-08-external-smoke-canonical-ipv6-preflight.md
git commit -m "docs: record canonical ipv6 preflight qa"
git push origin main
```

Note: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` is maintained outside this git repository and was updated directly rather than staged.

- [ ] **Step 6: Verify final sync**

Run:

```bash
npm test && git pull --ff-only && git status -sb && git rev-list --left-right --count origin/main...HEAD && git log --oneline -8
```

Expected:

```text
670 passed, 0 failed across 24 test file(s)
Already up to date.
0	0
```
