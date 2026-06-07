# Manifest Stale Lock Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover automatically when a crashed process leaves `SAMPLES_DIR/.manifest.lock` behind.

**Architecture:** Keep the existing same-process manifest mutation queue and cross-process directory lock. Add stale-lock detection based on the lock directory `mtimeMs`; when the lock is older than a conservative threshold, remove it and retry lock acquisition.

**Tech Stack:** Node.js `fs.promises`, existing source-extraction server tests, npm smoke scripts.

---

### Task 1: Stale Lock Regression Test

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/server/manifest-file-lock-tests.mjs`

- [x] **Step 1: Add failing stale lock tests**

Add coverage that proves `acquireManifestFileLock` checks the existing lock directory age, removes stale locks, retries acquisition, and does not remove fresh locks.

```js
check("withManifestFileLock removes stale lock before retry",
  events.map((event) => event.op),
  ["mkdir", "stat", "rmdir", "mkdir", "rmdir"]);

check("withManifestFileLock waits when existing lock is still fresh",
  events.map((event) => event.op),
  ["mkdir", "stat", "sleep", "mkdir", "rmdir"]);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/server/manifest-file-lock-tests.mjs
```

Expected: fails because stale-lock helpers or `stat`/`rmdir` behavior are not implemented yet.

### Task 2: Minimal Stale Lock Implementation

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/server.js`

- [x] **Step 1: Add threshold and helpers**

Add a conservative stale threshold near the existing manifest lock constants:

```js
const MANIFEST_FILE_LOCK_STALE_MS = 5 * 60 * 1000;
```

Add helpers before `acquireManifestFileLock`:

```js
function isManifestFileLockStale(lockStats, nowMs = Date.now()) {
  return Number.isFinite(lockStats?.mtimeMs) &&
    nowMs - lockStats.mtimeMs >= MANIFEST_FILE_LOCK_STALE_MS;
}

async function tryRemoveStaleManifestFileLock() {
  let lockStats = null;
  try {
    lockStats = await fsp.stat(manifestFileLockPath);
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
  if (!isManifestFileLockStale(lockStats)) return false;
  try {
    await fsp.rmdir(manifestFileLockPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
}
```

- [x] **Step 2: Wire helper into lock acquisition**

Inside the `EEXIST` branch of `acquireManifestFileLock`, call `tryRemoveStaleManifestFileLock()`. If it returns `true`, immediately continue the loop so the process retries `mkdir` without sleeping.

```js
const removedStaleLock = await tryRemoveStaleManifestFileLock();
if (removedStaleLock) continue;
```

- [x] **Step 3: Verify GREEN**

Run:

```bash
node test-artifacts/server/manifest-file-lock-tests.mjs
node test-artifacts/server/manifest-mutation-queue-tests.mjs
```

Expected: both pass.

### Task 3: Documentation And Full QA

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/README.md`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document stale lock behavior**

Update manifest stability notes to mention stale `.manifest.lock` recovery after the configured threshold.

- [x] **Step 2: Run verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/manifest-file-lock-tests.mjs
git diff --check
npm test
```

Expected: all commands exit 0; `npm test` reports all test files passed.

- [x] **Step 3: Commit and push**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-07-manifest-stale-lock-recovery.md server.js test-artifacts/server/manifest-file-lock-tests.mjs
git commit -m "fix: recover stale manifest file locks"
git push origin main
```
