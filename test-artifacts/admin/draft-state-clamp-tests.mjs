// draft-state normalizeStore clamp regression tests (Batch H).
//
// clampNumber returned the fallback unclamped on non-numeric input. For a
// persisted store with a corrupt live.turnIndex and a shorter-than-default
// sequence, the fallback (DEFAULT_STORE.live.turnIndex = 16) overshot the
// sequence range, so getCurrentStep returned undefined and downstream render
// crashed. normalizeStore must keep turnIndex within [0, sequence.length-1].

import fs from "fs";

const src = fs.readFileSync(new URL("../../draft-state.js", import.meta.url), "utf8");

// The module is an IIFE invoked with `window`; provide a fake window and read the export back.
const fakeWindow = {};
const LolDraftState = new Function("window", `${src}\nreturn window.LolDraftState;`)(fakeWindow);
const { createDefaultStore, normalizeStore, getCurrentStep, clone } = LolDraftState;

let pass = 0, fail = 0;
function checkTrue(label, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || !detail ? "" : `  — ${detail}`}`);
  cond ? pass++ : fail++;
}

const base = createDefaultStore();
const defaultLen = base.sequence.length;
checkTrue("default sequence is non-empty", defaultLen > 0);

// Corrupt store: non-numeric turnIndex + a shorter sequence than default.
function corruptStore(badTurnIndex, seqLen) {
  const s = clone(base);
  s.sequence = base.sequence.slice(0, seqLen);
  s.live.turnIndex = badTurnIndex;
  return s;
}

for (const bad of [null, undefined, "5", NaN, Infinity, {}]) {
  const seqLen = 3; // maxTurnIndex = 2, well below the fallback (16)
  const normalized = normalizeStore(corruptStore(bad, seqLen));
  const ti = normalized.live.turnIndex;
  checkTrue(
    `turnIndex clamped into range for bad value ${JSON.stringify(bad)}`,
    Number.isInteger(ti) && ti >= 0 && ti <= seqLen - 1,
    `got turnIndex=${ti}`,
  );
  const step = getCurrentStep(normalized);
  checkTrue(
    `getCurrentStep returns a valid step (no crash) for ${JSON.stringify(bad)}`,
    step != null && step.order !== undefined,
  );
}

// A valid in-range turnIndex must be preserved.
const okStore = clone(base);
okStore.live.turnIndex = 1;
checkTrue("valid turnIndex preserved", normalizeStore(okStore).live.turnIndex === 1);

// An over-range numeric turnIndex must clamp down to the last index.
const overStore = clone(base);
overStore.sequence = base.sequence.slice(0, 4); // max index 3
overStore.live.turnIndex = 99;
checkTrue("over-range numeric turnIndex clamps to last index", normalizeStore(overStore).live.turnIndex === 3);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
