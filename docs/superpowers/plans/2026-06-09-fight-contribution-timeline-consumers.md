# Fight Contribution Timeline Consumers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route timeline assist-like fight contribution consumers through `isFightContributionEvent(event)` so KDA and phase context policy stay aligned with strength/fight summaries.

**Architecture:** Keep `FIGHT_CONTRIBUTION_EVENT_TYPES` and `isFightContributionEvent(event)` as the source of truth for positive fight contribution events. Update only the two remaining consumers that currently repeat the assist-like subset, `buildPhaseContext()` and `buildKdaTimeline()`, while preserving `CHAMPION_KILL` as a kill because it is handled before the helper branch.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

## File Structure

- Create: `test-artifacts/server/timeline-consumer-tests.mjs` — focused extraction tests for phase context and KDA timeline event policy consumers.
- Modify: `server.js` — replace duplicate `TEAMFIGHT_FOLLOWUP` / `SKIRMISH_WIN` checks in `buildPhaseContext()` and `buildKdaTimeline()`.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` — append QA evidence for this improvement cycle.
- Modify: `docs/superpowers/plans/2026-06-09-fight-contribution-timeline-consumers.md` — mark steps complete and add completion evidence after verification.

### Task 1: Add Focused RED Coverage

**Files:**
- Create: `test-artifacts/server/timeline-consumer-tests.mjs`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/timeline-consumer-tests.mjs` with:

```js
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
  const m = source.match(new RegExp(`const ${name} = [^;]*;`));
  if (!m) throw new Error(`const ${name} not found`);
  return m[0];
}

const buildPhaseContextSrc = extractFunctionSource(serverSrc, "buildPhaseContext");
const buildKdaTimelineSrc = extractFunctionSource(serverSrc, "buildKdaTimeline");

const { buildPhaseContext, buildKdaTimeline } = new Function(
  [
    extractConstSource(serverSrc, "FIGHT_CONTRIBUTION_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isFightContributionEvent"),
    extractFunctionSource(serverSrc, "buildPhaseContext"),
    extractFunctionSource(serverSrc, "buildKdaTimeline"),
    "return { buildPhaseContext, buildKdaTimeline };",
  ].join("\n"),
)();

let pass = 0, fail = 0;
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

const phaseContext = buildPhaseContext([
  { phase: "EARLY", eventType: "CHAMPION_KILL", importance: 5 },
  { phase: "EARLY", eventType: "TEAMFIGHT_FOLLOWUP", importance: 4 },
  { phase: "EARLY", eventType: "SKIRMISH_WIN", importance: 3 },
  { phase: "EARLY", eventType: "PLAYER_DEATH", importance: 5 },
  { phase: "MID", eventType: "TEAMFIGHT_FOLLOWUP", importance: 4 },
]);

check("phaseContext EARLY keeps kill/death/assist counts", {
  kills: phaseContext.early.kills,
  deaths: phaseContext.early.deaths,
  assists: phaseContext.early.assists,
  notableEventCount: phaseContext.early.notableEventCount,
}, { kills: 1, deaths: 1, assists: 2, notableEventCount: 3 });
check("phaseContext MID counts followup assist", phaseContext.mid.assists, 1);

const kdaTimeline = buildKdaTimeline({
  timelineEvents: [
    { eventType: "TEAMFIGHT_FOLLOWUP", isPlayerInvolved: true, timestampMs: 100000, timestampLabel: "1:40", phase: "EARLY", summary: "follow" },
    { eventType: "SKIRMISH_WIN", isPlayerInvolved: true, timestampMs: 200000, timestampLabel: "3:20", phase: "EARLY", summary: "skirmish" },
    { eventType: "CHAMPION_KILL", isPlayerInvolved: true, timestampMs: 300000, timestampLabel: "5:00", phase: "EARLY", summary: "kill" },
    { eventType: "PLAYER_DEATH", isPlayerInvolved: true, timestampMs: 400000, timestampLabel: "6:40", phase: "EARLY", summary: "death" },
    { eventType: "TOWER_TAKE", isPlayerInvolved: true, timestampMs: 500000, timestampLabel: "8:20", phase: "EARLY", summary: "tower" },
  ],
});
const finalKdaPoint = kdaTimeline[kdaTimeline.length - 1];

check("kdaTimeline ignores non-KDA tower event", kdaTimeline.length, 5);
check("kdaTimeline final counts", {
  kills: finalKdaPoint.kills,
  deaths: finalKdaPoint.deaths,
  assists: finalKdaPoint.assists,
  kda: finalKdaPoint.kda,
}, { kills: 1, deaths: 1, assists: 2, kda: 3 });
checkTrue(
  "buildPhaseContext uses isFightContributionEvent for assist-like events",
  buildPhaseContextSrc.includes("isFightContributionEvent(event)"),
);
checkTrue(
  "buildKdaTimeline uses isFightContributionEvent for assist-like events",
  buildKdaTimelineSrc.includes("isFightContributionEvent(evt)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
node test-artifacts/server/timeline-consumer-tests.mjs
```

Expected: `4 passed, 2 failed`; the two failures are source-shape checks for `buildPhaseContext` and `buildKdaTimeline` using `isFightContributionEvent`.

### Task 2: Route Consumers Through Shared Helper

**Files:**
- Modify: `server.js`

- [x] **Step 1: Update `buildPhaseContext()`**

Replace:

```js
} else if (event.eventType === "TEAMFIGHT_FOLLOWUP" || event.eventType === "SKIRMISH_WIN") {
  bucket.assists += 1;
}
```

with:

```js
} else if (isFightContributionEvent(event)) {
  bucket.assists += 1;
}
```

- [x] **Step 2: Update `buildKdaTimeline()`**

Replace:

```js
} else if (evt.eventType === "TEAMFIGHT_FOLLOWUP" || evt.eventType === "SKIRMISH_WIN") {
  assists++;
  changed = true;
}
```

with:

```js
} else if (isFightContributionEvent(evt)) {
  assists++;
  changed = true;
}
```

- [x] **Step 3: Run focused test to verify it passes**

Run:

```bash
node test-artifacts/server/timeline-consumer-tests.mjs
```

Expected: `6 passed, 0 failed`.

### Task 3: Verify, Document, Commit, Push

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-fight-contribution-timeline-consumers.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/timeline-consumer-tests.mjs
node test-artifacts/server/timeline-consumer-tests.mjs
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/fight-contribution-timeline-consumers-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `node --check` commands exit 0.
- Focused test prints `6 passed, 0 failed`.
- `npm test` exits 0.
- Read-only smoke report exits 0.
- `git diff --check` exits 0.

- [ ] **Step 2: Update Obsidian QA log**

Append a cycle entry before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with local RED/GREEN evidence, `npm test`, local smoke summary, commit SHA, GitHub Actions run id, artifact id, sensitive scan result, and final `main...origin/main` sync count.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/timeline-consumer-tests.mjs docs/superpowers/plans/2026-06-09-fight-contribution-timeline-consumers.md
git diff --cached --check
git commit -m "test: share fight contribution timeline consumers"
git push origin main
```

Expected: commit and push succeed on `main`.

- [ ] **Step 4: Verify GitHub QA**

Run:

```bash
gh run list --workflow QA --branch main --limit 5
gh run watch <run-id> --exit-status
gh run download <run-id> --name qa-automation-<run-id> --dir test-artifacts/tmp/github-qa-<run-id>
```

Expected: QA run for the pushed commit passes, artifact summary reports smoke `156 passed, 0 failed`, required checks `13 passed, 0 failed`, dirty `false`, and no sensitive-value scan matches.

- [ ] **Step 5: Mark plan complete and final sync**

Update this plan with completion evidence, then run:

```bash
git add docs/superpowers/plans/2026-06-09-fight-contribution-timeline-consumers.md
git diff --cached --check
git commit -m "docs: mark fight timeline consumer plan complete"
git push origin main
rm -rf test-artifacts/tmp
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final status is `## main...origin/main` and rev-list output is `0 0`.

## Self-Review

- Spec coverage: The plan covers the two remaining assist-like fight contribution consumers found in `server.js`: `buildPhaseContext()` and `buildKdaTimeline()`.
- Placeholder scan: No placeholder wording is used for missing implementation or vague testing steps.
- Type consistency: `isFightContributionEvent(event)` accepts event objects; `buildPhaseContext()` passes `event`, and `buildKdaTimeline()` passes `evt`.
