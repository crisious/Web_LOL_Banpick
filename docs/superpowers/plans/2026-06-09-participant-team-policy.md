# Participant Team Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent `participantTeam(participantId)` from using JavaScript numeric coercion when mapping participant IDs to Riot team IDs.

**Architecture:** Keep `participantTeam()` as the single team-mapping helper in `server.js`, but make it accept only integer participant IDs. This complements `rawParticipantId(value)` so future call sites cannot accidentally classify strings or fractional values as team 100/200.

**Tech Stack:** Node.js ESM regression scripts under `test-artifacts/server`, existing single-file Node server helpers in `server.js`, `npm test`, read-only smoke report QA.

---

## File Structure

- Create: `test-artifacts/server/participant-team-policy-tests.mjs`
  - Direct helper coverage for valid participant IDs, malformed IDs, and source-shape checks.
- Modify: `server.js`
  - Add an integer guard at the start of `participantTeam(participantId)`.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
  - Record the improvement, RED/GREEN evidence, local QA, GitHub QA, and final sync status.

## Task 1: Write RED Regression Coverage

**Files:**
- Create: `test-artifacts/server/participant-team-policy-tests.mjs`

- [ ] **Step 1: Add the focused regression test file**

```js
// server.js participant team policy regression tests

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") { depth += 1; bodyStarted = true; }
    else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

const participantTeamSrc = extractFunctionSource(serverSrc, "participantTeam");
const { participantTeam } = new Function(
  [
    participantTeamSrc,
    "return { participantTeam };",
  ].join("\n"),
)();

let pass = 0;
let fail = 0;
function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}
function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

check("participantTeam maps participant 1 to blue team", participantTeam(1), 100);
check("participantTeam maps participant 5 to blue team", participantTeam(5), 100);
check("participantTeam maps participant 6 to red team", participantTeam(6), 200);
check("participantTeam maps participant 10 to red team", participantTeam(10), 200);
check("participantTeam rejects zero", participantTeam(0), null);
check("participantTeam rejects out-of-range id", participantTeam(11), null);
check("participantTeam rejects string blue id", participantTeam("2"), null);
check("participantTeam rejects string red id", participantTeam("7"), null);
check("participantTeam rejects fractional id", participantTeam(2.5), null);
check("participantTeam rejects Infinity", participantTeam(Infinity), null);
check("participantTeam rejects NaN", participantTeam(NaN), null);
check("participantTeam rejects null", participantTeam(null), null);
checkTrue(
  "participantTeam guards integer participant ids before range comparisons",
  participantTeamSrc.includes("if (!Number.isInteger(participantId))") &&
    participantTeamSrc.includes("return null;"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 2: Run the RED test**

Run:

```bash
node test-artifacts/server/participant-team-policy-tests.mjs
```

Expected: FAIL because production `participantTeam()` currently maps `"2"` and `2.5` to team 100 and `"7"` to team 200 through JavaScript comparison coercion.

## Task 2: Implement Minimal Guard

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add an integer guard**

Replace:

```js
function participantTeam(participantId) {
  if (participantId >= 1 && participantId <= 5) {
```

With:

```js
function participantTeam(participantId) {
  if (!Number.isInteger(participantId)) {
    return null;
  }
  if (participantId >= 1 && participantId <= 5) {
```

- [ ] **Step 2: Run the focused GREEN test**

Run:

```bash
node test-artifacts/server/participant-team-policy-tests.mjs
```

Expected: `13 passed, 0 failed`.

## Task 3: Local QA

**Files:**
- Verify changed code and adjacent raw timeline policies.

- [ ] **Step 1: Syntax check changed JavaScript**

Run:

```bash
node --check server.js
node --check test-artifacts/server/participant-team-policy-tests.mjs
```

Expected: both commands exit `0`.

- [ ] **Step 2: Run focused raw timeline helper tests**

Run:

```bash
node test-artifacts/server/participant-team-policy-tests.mjs
node test-artifacts/server/raw-participant-id-policy-tests.mjs
node test-artifacts/server/raw-assist-participant-id-policy-tests.mjs
node test-artifacts/server/raw-event-timestamp-tests.mjs
node test-artifacts/server/raw-building-team-policy-tests.mjs
node test-artifacts/server/raw-timeline-event-type-tests.mjs
```

Expected: every command exits `0`.

- [ ] **Step 3: Run full suite and read-only smoke**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/participant-team-policy-local npm run smoke:report:readonly
git diff --check
```

Expected: `npm test` exits `0`, smoke report `latestRun.qaVerdict.status` is `passed`, and `git diff --check` exits `0`.

## Task 4: Docs, Commit, Push, GitHub QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-participant-team-policy.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Update docs with QA evidence**

Record RED, GREEN, full local QA, smoke report, Git commit SHA, GitHub Actions run ID, artifact ID, and final `main...origin/main` sync evidence.

- [x] **Step 2: Commit and push implementation**

Run:

```bash
rm -rf test-artifacts/tmp
git diff --check
git status --short --branch
git add server.js test-artifacts/server/participant-team-policy-tests.mjs docs/superpowers/plans/2026-06-09-participant-team-policy.md
git diff --cached --check
git commit -m "test: guard participant team mapping"
git push origin main
```

Evidence:
- Implementation commit `359c903` (`test: guard participant team mapping`) was pushed to `origin/main`.

- [x] **Step 3: Verify GitHub Actions QA**

Run:

```bash
gh run list --workflow QA --branch main --limit 8 --json databaseId,headSha,headBranch,status,conclusion,displayTitle,createdAt,url
gh run watch <run-id> --exit-status
```

Download and inspect the smoke artifact for pass/fail counts and sensitive pattern matches.

Evidence:
- GitHub Actions QA run `27163073742` passed for head SHA `359c9038014d2bafd4c527cba9704e5a85fb250a`.
- Workflow artifact `7490872007` (`qa-automation-27163073742`, 3556 bytes) was downloaded and inspected.
- Artifact `qa-summary.json`: `latestRun.qaVerdict.status: "passed"`, smoke 156 passed / 0 failed, required checks total 13 / passed 13 / failed 0 / missing 0, `durationMs: 229`, `latestRun.git.shortSha: "359c903"`, `dirty: false`.
- GitHub artifact high-risk sensitive pattern scan: no matches.

- [ ] **Step 4: Commit final documentation and sync**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-participant-team-policy.md
git diff --cached --check
git commit -m "docs: finalize participant team policy"
git push origin main
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final status is `## main...origin/main` and `0 0`.

## Self-Review

- Spec coverage: The plan covers helper behavior, source-shape checks, RED/GREEN proof, full local QA, GitHub QA, Obsidian docs, and final sync.
- Placeholder scan: No blocked placeholder wording is used.
- Type consistency: `participantTeam(participantId)` accepts numeric integer participant IDs and returns Riot team ID `100`, Riot team ID `200`, or `null`.

## Execution Evidence

### 2026-06-09 04:53 KST - Local TDD and QA

- RED:
  - `node test-artifacts/server/participant-team-policy-tests.mjs`
  - Result: 9 passed / 4 failed.
  - Expected failures confirmed: `participantTeam("2")` returned 100, `participantTeam("7")` returned 200, `participantTeam(2.5)` returned 100, and the source-shape check did not find an integer guard.
- GREEN:
  - `node test-artifacts/server/participant-team-policy-tests.mjs`: 13 passed / 0 failed.
  - `node test-artifacts/server/raw-participant-id-policy-tests.mjs`: 17 passed / 0 failed.
  - `node test-artifacts/server/raw-assist-participant-id-policy-tests.mjs`: 12 passed / 0 failed.
  - `node test-artifacts/server/raw-building-team-policy-tests.mjs`: 28 passed / 0 failed.
- Focused adjacent policy QA:
  - `node --check server.js && node --check test-artifacts/server/participant-team-policy-tests.mjs`: exit 0.
  - `node test-artifacts/server/raw-event-timestamp-tests.mjs`: 15 passed / 0 failed.
  - `node test-artifacts/server/raw-timeline-event-type-tests.mjs`: 31 passed / 0 failed.
  - `node test-artifacts/server/raw-assist-array-tests.mjs`: 13 passed / 0 failed.
  - `node test-artifacts/server/raw-player-involvement-tests.mjs`: 12 passed / 0 failed.
- Full local QA:
  - `npm test`: 1701 passed / 0 failed across 52 test file(s).
  - `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/participant-team-policy-local npm run smoke:report:readonly`: 156 passed / 0 failed.
  - Smoke summary: `latestRun.qaVerdict.status: "passed"`, required checks total 13 / passed 13 / failed 0 / missing 0, `durationMs: 205`, mode `readonly`.
  - Local smoke artifact high-risk sensitive pattern scan: no matches for Riot key, Authorization/Bearer, Riot host, local user path, `api_key`, or `secret.json`.
  - `git diff --check`: exit 0.

### 2026-06-09 04:54 KST - Implementation Push QA

- Implementation commit `359c903` (`test: guard participant team mapping`) pushed to `origin/main`.
- GitHub Actions QA run `27163073742` passed for head SHA `359c9038014d2bafd4c527cba9704e5a85fb250a`.
- GitHub artifact `7490872007` (`qa-automation-27163073742`, 3556 bytes) inspected.
- Artifact summary: read-only smoke 156 passed / 0 failed, `durationMs: 229`, `latestRun.qaVerdict.status: "passed"`, required checks total 13 / passed 13 / failed 0 / missing 0, `latestRun.git.shortSha: "359c903"`, `dirty: false`.
- GitHub artifact high-risk sensitive pattern scan: no matches.
