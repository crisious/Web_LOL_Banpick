# Phase Context End Time Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure `buildPhaseContext()` derives `late.endMs` from normalized timeline event times instead of trusting the raw final event timestamp.

**Architecture:** Keep the policy inside `server.js` where `buildPhaseContext()` already owns phase bucket metadata. Add a focused regression test that extracts the function and its direct dependencies from `server.js`, then verifies malformed and out-of-order event timestamps cannot leak into `phaseContext.late.endMs`.

**Tech Stack:** Node.js ESM test scripts, `server.js` pure helper extraction, npm QA scripts.

---

### Task 1: Pin Phase Context End Time Policy

**Files:**
- Create: `test-artifacts/server/phase-context-endms-policy-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-phase-context-endms-policy.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/phase-context-endms-policy-tests.mjs` with:

```js
// server.js phase context endMs timestamp policy regression tests

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

function extractConstSource(source, name) {
  const match = source.match(new RegExp(`const ${name} = [^;]*;`));
  if (!match) throw new Error(`const ${name} not found`);
  return match[0];
}

const buildPhaseContextSrc = extractFunctionSource(serverSrc, "buildPhaseContext");

const { buildPhaseContext } = new Function(
  [
    extractConstSource(serverSrc, "PLAYER_KILL_EVENT_TYPES"),
    extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
    extractConstSource(serverSrc, "FIGHT_CONTRIBUTION_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isPlayerKillEvent"),
    extractFunctionSource(serverSrc, "isPlayerDeathEvent"),
    extractFunctionSource(serverSrc, "isFightContributionEvent"),
    extractFunctionSource(serverSrc, "phaseFor"),
    extractFunctionSource(serverSrc, "rawEventTimestampMs"),
    buildPhaseContextSrc,
    "return { buildPhaseContext };",
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

const mixedTimeline = buildPhaseContext([
  { eventType: "CHAMPION_KILL", timestampMs: 1900000, importance: 5 },
  { eventType: "PLAYER_DEATH", timestampMs: "bad", importance: 5 },
  { eventType: "TEAMFIGHT_FOLLOWUP", timestampMs: -100, importance: 4 },
]);

check("late endMs derives max normalized timestamp", mixedTimeline.late.endMs, 1900000);
check("malformed and negative events still bucket by normalized early time", {
  deaths: mixedTimeline.early.deaths,
  assists: mixedTimeline.early.assists,
  notableEventCount: mixedTimeline.early.notableEventCount,
}, { deaths: 1, assists: 1, notableEventCount: 2 });
check("valid late event keeps late counts", {
  kills: mixedTimeline.late.kills,
  notableEventCount: mixedTimeline.late.notableEventCount,
}, { kills: 1, notableEventCount: 1 });
check("empty late endMs keeps default boundary", buildPhaseContext([]).late.endMs, 1800001);

checkTrue(
  "buildPhaseContext derives timelineEndMs with reduce",
  buildPhaseContextSrc.includes("const timelineEndMs = events.reduce((maxTime, event) => {"),
);
checkTrue(
  "timelineEndMs normalizes each event timestamp",
  buildPhaseContextSrc.includes("const time = rawEventTimestampMs({ timestamp: event.timestampMs });"),
);
checkTrue(
  "timelineEndMs keeps max normalized event time",
  buildPhaseContextSrc.includes("return Math.max(maxTime, time);"),
);
checkTrue(
  "buildPhaseContext no longer trusts raw final event timestamp",
  !buildPhaseContextSrc.includes("events[events.length - 1].timestampMs"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/phase-context-endms-policy-tests.mjs
node test-artifacts/server/phase-context-endms-policy-tests.mjs
```

Expected: syntax check passes, runtime test fails because `late.endMs` still uses `events[events.length - 1].timestampMs`.

- [x] **Step 3: Implement the minimal policy change**

In `server.js`, update `buildPhaseContext(events)` so it computes a normalized timeline end before declaring phase buckets:

```js
function buildPhaseContext(events) {
  const timelineEndMs = events.reduce((maxTime, event) => {
    const time = rawEventTimestampMs({ timestamp: event.timestampMs });
    return Math.max(maxTime, time);
  }, 1800001);

  const phases = {
    EARLY: { startMs: 0, endMs: 900000, kills: 0, deaths: 0, assists: 0, notableEventCount: 0 },
    MID: {
      startMs: 900001,
      endMs: 1800000,
      kills: 0,
      deaths: 0,
      assists: 0,
      notableEventCount: 0,
    },
    LATE: {
      startMs: 1800001,
      endMs: timelineEndMs,
      kills: 0,
      deaths: 0,
      assists: 0,
      notableEventCount: 0,
    },
  };
```

- [x] **Step 4: Run focused QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/phase-context-endms-policy-tests.mjs
node --check test-artifacts/server/phase-summary-timestamp-policy-tests.mjs
node test-artifacts/server/phase-context-endms-policy-tests.mjs
node test-artifacts/server/phase-summary-timestamp-policy-tests.mjs
node test-artifacts/server/timeline-consumer-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
node test-artifacts/schema/schema-tests.mjs
```

Expected: all commands pass.

- [x] **Step 5: Run full local QA and smoke report**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-context-endms-policy-local npm run smoke:report:readonly
node -e "const fs=require('fs'); const summary=JSON.parse(fs.readFileSync('test-artifacts/tmp/phase-context-endms-policy-local/qa-summary.json','utf8')); const run=summary.latestRun; const requiredPassed=run.requiredChecks.filter((check)=>check.status==='pass').length; console.log(JSON.stringify({qaStatus:run.qaVerdict.status,requiredPassed,requiredTotal:run.requiredChecks.length,smokePassed:run.smokeSummary.passed,smokeFailed:run.smokeSummary.failed,durationMs:run.durationMs,mode:run.mode,gitShortSha:run.git.shortSha,gitDirty:run.git.dirty},null,2));"
rg -n --hidden -S "RGAPI-|api_key|RIOT_API_KEY|OPENAI_API_KEY|BEGIN (RSA|OPENSSH|PRIVATE) KEY|secret.json|/Users/|/runtime/samples|kr\\.api\\.riotgames\\.com|getaddrinfo|Unexpected token" test-artifacts/tmp/phase-context-endms-policy-local
```

Expected: `npm test` passes, diff has no whitespace errors, smoke verdict is `pass`, sensitive scan has no matches except the scan command recorded in report metadata if present.

- [ ] **Step 6: Commit and push with GitHub QA evidence**

Run:

```bash
rm -rf test-artifacts/tmp
git status --short --branch
git add docs/superpowers/plans/2026-06-09-phase-context-endms-policy.md server.js test-artifacts/server/phase-context-endms-policy-tests.mjs
git commit -m "test: guard phase context end time"
git push origin main
gh run list --workflow QA --branch main --limit 8 --json databaseId,headSha,status,conclusion,displayTitle,createdAt,url
gh run watch <run-id> --exit-status
```

Expected: push succeeds, GitHub QA succeeds for the pushed commit, artifact summary reports a passing smoke run.

### Execution Notes

- 2026-06-09 08:01 KST: Current `main` and `origin/main` are synchronized at `0c65015`. `buildPhaseContext()` still sets `LATE.endMs` from `events[events.length - 1].timestampMs`, while phase bucketing already normalizes `event.timestampMs`.
- 2026-06-09 08:02 KST: RED confirmed. `node --check test-artifacts/server/phase-context-endms-policy-tests.mjs` passed, and `node test-artifacts/server/phase-context-endms-policy-tests.mjs` failed 4/8 with `late endMs derives max normalized timestamp` showing expected `1900000`, got `-100`.
- 2026-06-09 08:03 KST: GREEN focused QA passed: `node --check server.js`, `node --check test-artifacts/server/phase-context-endms-policy-tests.mjs`, `node --check test-artifacts/server/phase-summary-timestamp-policy-tests.mjs`, new phase context endMs test 8/0, phase summary timestamp policy 9/0, timeline consumer 12/0, LLM payload 84/0, schema 86/0.
- 2026-06-09 08:05 KST: Full local QA passed. `npm test` reported 1920 passed, 0 failed across 70 test files. `git diff --check` passed. Read-only smoke report passed with QA verdict `passed`, required checks 13/13, smoke 156/0, duration 609 ms, mode `readonly`, local dirty state expected before commit. Sensitive/runtime-path scan over `test-artifacts/tmp/phase-context-endms-policy-local` returned no matches.
