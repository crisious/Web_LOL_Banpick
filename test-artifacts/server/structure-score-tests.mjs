// server.js calcStructureScore policy regression tests

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

const structureTakePolicySources = serverSrc.includes("const STRUCTURE_TAKE_EVENT_TYPES =")
  ? [
      extractConstSource(serverSrc, "STRUCTURE_TAKE_EVENT_TYPES"),
      extractFunctionSource(serverSrc, "isStructureTakeEvent"),
    ]
  : [
      'const STRUCTURE_TAKE_EVENT_TYPES = new Set(["TOWER_TAKE"]);',
      'function isStructureTakeEvent(event) { return STRUCTURE_TAKE_EVENT_TYPES.has(event.eventType); }',
    ];

const calcStructureScoreSrc = extractFunctionSource(serverSrc, "calcStructureScore");

const { calcStructureScore } = new Function(
  [
    ...structureTakePolicySources,
    extractFunctionSource(serverSrc, "clamp10"),
    extractFunctionSource(serverSrc, "calcStructureScore"),
    "return { calcStructureScore };",
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

const tower = () => ({ eventType: "TOWER_TAKE" });
const dragon = () => ({ eventType: "DRAGON_FIGHT" });

check("calcStructureScore neutral towers and neutral diff", calcStructureScore({ teamTowers: 5, enemyTowers: 5 }, []), 2);
check("calcStructureScore 3 towers and +2 tower diff", calcStructureScore(
  { teamTowers: 8, enemyTowers: 6 },
  [tower(), tower(), tower()],
), 7.8);
check("calcStructureScore caps structure pressure at 10", calcStructureScore(
  { teamTowers: 10, enemyTowers: 7 },
  [tower(), tower(), tower(), tower(), tower(), tower()],
), 10);
check("calcStructureScore ignores non-structure objective events", calcStructureScore(
  { teamTowers: 5, enemyTowers: 5 },
  [dragon(), dragon()],
), 2);
checkTrue(
  "server defines STRUCTURE_TAKE_EVENT_TYPES",
  serverSrc.includes('const STRUCTURE_TAKE_EVENT_TYPES = new Set(["TOWER_TAKE"]);'),
);
checkTrue(
  "server defines isStructureTakeEvent",
  serverSrc.includes("function isStructureTakeEvent(event)"),
);
checkTrue(
  "calcStructureScore uses isStructureTakeEvent",
  calcStructureScoreSrc.includes("events.filter(isStructureTakeEvent).length"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
