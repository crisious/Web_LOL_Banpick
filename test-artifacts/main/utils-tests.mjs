// Track S — main.js의 순수 유틸 함수 회귀 테스트
//
// 검증 대상:
//   1) compactPatchLabel — Riot 시즌 ordinal → 공개 패치 연도 매핑 (S16 → 26.X)
//   2) _computeDeltaParts — 메트릭 delta 노이즈 컷 + 부호 판정
//   3) championDisplayName — CamelCase 챔피언명 → 공백 분리

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

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

const compactSrc = extractFunctionSource(mainSrc, "compactPatchLabel");
const deltaSrc = extractFunctionSource(mainSrc, "_computeDeltaParts");
const champSrc = extractFunctionSource(mainSrc, "championDisplayName");

const fns = new Function(
  `${compactSrc}\n${deltaSrc}\n${champSrc}\n` +
  `return { compactPatchLabel, _computeDeltaParts, championDisplayName };`,
)();
const { compactPatchLabel, _computeDeltaParts, championDisplayName } = fns;

let pass = 0, fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

// ─── compactPatchLabel ──────────────────────────────────────────────────────

check("compactPatch: 16.7.760.9485 → 26.7", compactPatchLabel("16.7.760.9485"), "26.7");
check("compactPatch: 15.10 → 25.10", compactPatchLabel("15.10"), "25.10");
check("compactPatch: 1.0 → 11.0 (edge: low season)", compactPatchLabel("1.0"), "11.0");
check("compactPatch: '' → ''", compactPatchLabel(""), "");
check("compactPatch: null → ''", compactPatchLabel(null), "");
check("compactPatch: undefined → ''", compactPatchLabel(undefined), "");
check("compactPatch: 'abc' (no dot) → 'abc'", compactPatchLabel("abc"), "abc");
check("compactPatch: 'abc.def' (NaN major) → 'abc.def' (uses raw parts[0])",
  compactPatchLabel("abc.def"), "abc.def");

// ─── _computeDeltaParts ─────────────────────────────────────────────────────

check("delta: (10, 5) → up 5.0",
  _computeDeltaParts(10, 5),
  { isUp: true, formatted: "5.0", label: "비교" });

check("delta: (5, 10) → down 5.0",
  _computeDeltaParts(5, 10),
  { isUp: false, formatted: "5.0", label: "비교" });

check("delta: (5, 5) — no diff → null",
  _computeDeltaParts(5, 5), null);

check("delta: (5.04, 5) — below 0.05 floor → null",
  _computeDeltaParts(5.04, 5), null);

check("delta: (5.06, 5) — above 0.05 floor → up",
  _computeDeltaParts(5.06, 5),
  { isUp: true, formatted: "0.1", label: "비교" });

// 임계값은 strict-less-than(`<`)로 비교 — diff가 정확히 1% 경계와 같으면 표시.
// (101, 100)의 diff=1, threshold=max(1, 0.05)=1 → 1 < 1 false → 표시.
check("delta: (101, 100) — diff exactly at 1% threshold → shown (strict-less)",
  _computeDeltaParts(101, 100),
  { isUp: true, formatted: "1.0", label: "비교" });

check("delta: (100.99, 100) — diff just below 1% → null",
  _computeDeltaParts(100.99, 100), null);

check("delta: (102, 100) — diff 2 above 1% → up",
  _computeDeltaParts(102, 100),
  { isUp: true, formatted: "2.0", label: "비교" });

check("delta: (NaN, 5) → null",
  _computeDeltaParts(NaN, 5), null);

check("delta: (5, NaN) → null",
  _computeDeltaParts(5, NaN), null);

check("delta: (5, Infinity) → null",
  _computeDeltaParts(5, Infinity), null);

check("delta: (0, 0) → null (both zero)",
  _computeDeltaParts(0, 0), null);

check("delta: opts.label preserved",
  _computeDeltaParts(10, 5, { label: "평균" }),
  { isUp: true, formatted: "5.0", label: "평균" });

check("delta: opts.formatValue applied",
  _computeDeltaParts(10, 5, { formatValue: (v) => `+${v.toFixed(2)}%` }),
  { isUp: true, formatted: "+5.00%", label: "비교" });

// ─── championDisplayName ────────────────────────────────────────────────────

check("champion: DrMundo → Dr Mundo", championDisplayName("DrMundo"), "Dr Mundo");
check("champion: KhaZix → Kha Zix", championDisplayName("KhaZix"), "Kha Zix");
check("champion: MissFortune → Miss Fortune", championDisplayName("MissFortune"), "Miss Fortune");
check("champion: Yasuo (no camel) → Yasuo", championDisplayName("Yasuo"), "Yasuo");
check("champion: '' → ''", championDisplayName(""), "");
check("champion: null → ''", championDisplayName(null), "");
check("champion: undefined → ''", championDisplayName(undefined), "");
check("champion: '  Yone  ' (trim) → Yone", championDisplayName("  Yone  "), "Yone");

// ─── 결과 ────────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
