# Key Moment Phase Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make stored sample key moment cards show a phase label even when legacy `keyMoments[]` entries omit `phase`.

**Architecture:** Add a small pure helper in `main.js` that preserves an explicit `moment.phase` when present and otherwise infers `EARLY`/`MID`/`LATE` from the first `MM:SS` timestamp in `timestamp` or `timestampLabel`. `renderKeyMoments()` will use the helper for its phase badge, keeping legacy stored samples readable without bulk-editing every analysis JSON bundle.

**Tech Stack:** Vanilla JavaScript frontend, existing text-extraction test harness in `test-artifacts/main/utils-tests.mjs`, local smoke runner.

---

## File Map

- Modify: `main.js`
  - Add `keyMomentPhase(moment)` near pure UI helpers.
  - Use `keyMomentPhase(moment)` in `renderKeyMoments()`.
- Modify: `test-artifacts/main/utils-tests.mjs`
  - Extract `keyMomentPhase()`.
  - Add RED tests for explicit phase preservation and timestamp-based fallback.
- Create: `docs/superpowers/plans/2026-06-08-key-moment-phase-fallback.md`
  - Record the implementation plan and QA checklist.

## Task 1: Add RED Main Utility Tests

**Files:**
- Modify: `test-artifacts/main/utils-tests.mjs`

- [x] **Step 1: Update test header**

Replace the header comment:

```js
//   3) championDisplayName — CamelCase 챔피언명 → 공백 분리
```

With:

```js
//   3) championDisplayName — CamelCase 챔피언명 → 공백 분리
//   4) keyMomentPhase — legacy 핵심 장면 timestamp → phase fallback
```

- [x] **Step 2: Extract `keyMomentPhase()`**

Add this extraction after `const champSrc = extractFunctionSource(mainSrc, "championDisplayName");`:

```js
const keyMomentPhaseSrc = extractFunctionSource(mainSrc, "keyMomentPhase");
```

Replace the `new Function` body:

```js
  `${compactSrc}\n${deltaSrc}\n${champSrc}\n` +
  `return { compactPatchLabel, _computeDeltaParts, championDisplayName };`,
```

With:

```js
  `${compactSrc}\n${deltaSrc}\n${champSrc}\n${keyMomentPhaseSrc}\n` +
  `return { compactPatchLabel, _computeDeltaParts, championDisplayName, keyMomentPhase };`,
```

Replace the destructuring:

```js
const { compactPatchLabel, _computeDeltaParts, championDisplayName } = fns;
```

With:

```js
const { compactPatchLabel, _computeDeltaParts, championDisplayName, keyMomentPhase } = fns;
```

- [x] **Step 3: Add key moment phase fallback tests**

Insert this block after the `championDisplayName` tests and before the result section:

```js
// ─── keyMomentPhase ─────────────────────────────────────────────────────────

check("keyMomentPhase: explicit phase wins",
  keyMomentPhase({ phase: "MID", timestampLabel: "04:46" }), "MID");

check("keyMomentPhase: trims explicit phase",
  keyMomentPhase({ phase: " LATE ", timestampLabel: "04:46" }), "LATE");

check("keyMomentPhase: timestampLabel 04:46 → EARLY",
  keyMomentPhase({ timestampLabel: "04:46" }), "EARLY");

check("keyMomentPhase: timestampLabel range uses first time",
  keyMomentPhase({ timestampLabel: "14:59~16:00" }), "EARLY");

check("keyMomentPhase: timestamp 15:00 → MID",
  keyMomentPhase({ timestamp: "15:00" }), "MID");

check("keyMomentPhase: timestampLabel 29:59 → MID",
  keyMomentPhase({ timestampLabel: "29:59" }), "MID");

check("keyMomentPhase: timestampLabel 30:00 → LATE",
  keyMomentPhase({ timestampLabel: "30:00" }), "LATE");

check("keyMomentPhase: invalid timestamp → empty string",
  keyMomentPhase({ timestampLabel: "not-a-time" }), "");
```

- [x] **Step 4: Verify RED**

Run:

```bash
node test-artifacts/main/utils-tests.mjs
```

Expected output:

```text
Error: function keyMomentPhase not found
```

The test harness should fail before assertions because `main.js` has no helper yet.

## Task 2: Implement `keyMomentPhase()` And Wire Renderer

**Files:**
- Modify: `main.js`

- [x] **Step 1: Add helper**

Add this helper after `championDisplayName()`:

```js
function keyMomentPhase(moment) {
  if (typeof moment?.phase === "string" && moment.phase.trim()) {
    return moment.phase.trim();
  }
  const rawTimestamp = String(moment?.timestamp || moment?.timestampLabel || "");
  const match = rawTimestamp.match(/(\d{1,3}):([0-5]\d)/);
  if (!match) return "";
  const minute = Number(match[1]);
  if (!Number.isFinite(minute)) return "";
  if (minute < 15) return "EARLY";
  if (minute < 30) return "MID";
  return "LATE";
}
```

- [x] **Step 2: Use helper in key moment cards**

Replace this line in `renderKeyMoments()`:

```js
            <strong>${escapeHtml(moment.phase)}</strong>
```

With:

```js
            <strong>${escapeHtml(keyMomentPhase(moment))}</strong>
```

- [x] **Step 3: Verify GREEN**

Run:

```bash
node test-artifacts/main/utils-tests.mjs
```

Expected output:

```text
38 passed, 0 failed
```

## Task 3: QA, Commit, Push, And GitHub Verification

**Files:**
- Modify: `main.js`
- Modify: `test-artifacts/main/utils-tests.mjs`
- Create: `docs/superpowers/plans/2026-06-08-key-moment-phase-fallback.md`

- [x] **Step 1: Run syntax and focused checks**

Run:

```bash
node --check main.js
node --check test-artifacts/main/utils-tests.mjs
git diff --check
node test-artifacts/main/utils-tests.mjs
```

Expected:

```text
38 passed, 0 failed
```

- [x] **Step 2: Verify stored sample fallback coverage**

Run:

```bash
node -e 'const fs=require("fs"); const manifest=JSON.parse(fs.readFileSync("data/samples/manifest.json","utf8")); let missing=0; for (const s of manifest.samples) { const a=JSON.parse(fs.readFileSync(s.analysisPath.replace(/^\\//,""),"utf8")); for (const item of a.keyMoments || []) { if (typeof item.phase !== "string" || !item.phase.trim()) missing += 1; } } console.log(`legacy keyMoments missing explicit phase ${missing}`);'
```

Expected output:

```text
legacy keyMoments missing explicit phase 69
```

This confirms the fallback protects existing read-only sample cards without requiring a bulk fixture rewrite.

- [x] **Step 3: Run full tests**

Run:

```bash
npm test
```

Expected:

```text
1392 passed, 0 failed across 40 test file(s)
```

- [x] **Step 4: Run local read-only smoke report**

Start the app:

```bash
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
```

Then run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moment-phase-fallback-local npm run smoke:report:readonly
```

Expected:

```text
External demo smoke passed for http://127.0.0.1:8123
```

Inspect `smoke-report.json` under the generated timestamp directory and confirm it reports 156 passed / 0 failed with `status: "passed"`.

- [x] **Step 5: Run Browser UI fallback check**

Open the local read-only demo, select `sample-kr-8242613150`, and inspect the "경기 흐름을 바꾼 장면" panel.

Expected:

```text
source keyMoments missing explicit phase: 4
rendered phase badges: EARLY, EARLY, MID, MID
```

- [x] **Step 6: Scan temporary smoke output for sensitive patterns**

Run:

```bash
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/key-moment-phase-fallback-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected:

```text
no sensitive matches
```

- [ ] **Step 7: Commit and push**

Run:

```bash
git fetch origin --prune
git rev-list --left-right --count main...origin/main
git add main.js test-artifacts/main/utils-tests.mjs docs/superpowers/plans/2026-06-08-key-moment-phase-fallback.md
git commit -m "fix: infer key moment phase labels"
git push origin main
```

Expected: the ahead/behind count is `0 0` before commit, and push updates `origin/main`.

- [ ] **Step 8: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --workflow QA --branch main --limit 1 --json databaseId,headSha --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh api "repos/crisious/Web_LOL_Banpick/actions/runs/$RUN_ID/artifacts" --jq '.artifacts[] | {id, name, expired, size_in_bytes}'
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/key-moment-phase-fallback-gh
```

Expected: the new run for the pushed commit completes with `conclusion: "success"`, the artifact downloads, `qa-summary.json` reports 156 passed / 0 failed, and the sensitive pattern scan reports no matches.

## Self-Review

- Spec coverage: The plan covers the identified legacy key moment phase gap, TDD RED/GREEN, renderer wiring, stored sample impact check, local unit/full/smoke QA, GitHub QA artifact verification, and sensitive-output scanning.
- Placeholder scan: The plan contains concrete file paths, code snippets, commands, expected outputs, run id discovery, and artifact handling.
- Type consistency: `keyMomentPhase(moment)` is the helper name used by tests and `renderKeyMoments()`, and it returns the existing uppercase phase tokens expected by the UI badge.
