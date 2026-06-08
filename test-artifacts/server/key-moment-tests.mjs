// server.js key moment player-death policy regression tests

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

const playerDeathPolicySources = serverSrc.includes("const PLAYER_DEATH_EVENT_TYPES =")
  ? [
      extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
      extractFunctionSource(serverSrc, "isPlayerDeathEvent"),
    ]
  : [
      'const PLAYER_DEATH_EVENT_TYPES = new Set(["PLAYER_DEATH"]);',
      'function isPlayerDeathEvent(event) { return PLAYER_DEATH_EVENT_TYPES.has(event.eventType); }',
    ];

const impactForMomentSrc = extractFunctionSource(serverSrc, "impactForMoment");

const { impactForMoment } = new Function(
  [
    ...playerDeathPolicySources,
    extractFunctionSource(serverSrc, "impactForMoment"),
    "return { impactForMoment };",
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

check("impactForMoment death in win", impactForMoment({ eventType: "PLAYER_DEATH" }, "WIN"), "이기는 흐름을 다소 늦췄다.");
check("impactForMoment death in loss", impactForMoment({ eventType: "PLAYER_DEATH" }, "LOSS"), "팀 운영이 크게 흔들렸다.");
check("impactForMoment dragon objective", impactForMoment({ eventType: "DRAGON_FIGHT" }, "LOSS"), "오브젝트 주도권에 직접 영향을 줬다.");
check("impactForMoment tower take", impactForMoment({ eventType: "TOWER_TAKE" }, "WIN"), "승리 조건을 구조물로 전환했다.");
check("impactForMoment default combat", impactForMoment({ eventType: "TEAMFIGHT_FOLLOWUP" }, "WIN"), "교전 흐름을 유리하게 만드는 장면이었다.");
checkTrue(
  "server defines PLAYER_DEATH_EVENT_TYPES",
  serverSrc.includes('const PLAYER_DEATH_EVENT_TYPES = new Set(["PLAYER_DEATH"]);'),
);
checkTrue(
  "server defines isPlayerDeathEvent",
  serverSrc.includes("function isPlayerDeathEvent(event)"),
);
checkTrue(
  "impactForMoment uses isPlayerDeathEvent",
  impactForMomentSrc.includes("isPlayerDeathEvent(event)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
