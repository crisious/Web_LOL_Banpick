// Phase 34 — server.js 한타 단계별 분석(buildTeamfightPhases 등) 회귀 테스트
// 텍스트 추출 + new Function 패턴 (llm-payload-tests.mjs / 기존 Phase 33 테스트와 동일).
import fs from "fs";
const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0, started = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") { depth += 1; started = true; }
    else if (ch === "}") { depth -= 1; if (started && depth === 0) return source.slice(startIdx, i + 1); }
  }
  throw new Error(`function ${name} not closed`);
}
function extractConstSource(source, name) {
  const m = source.match(new RegExp(`const ${name} = [^;]*;`));
  if (!m) throw new Error(`const ${name} not found`);
  return m[0];
}

const env = new Function(
  [
    extractConstSource(serverSrc, "TEAMFIGHT_MIN_EVENTS"),
    extractConstSource(serverSrc, "CLEANUP_GAP_MS"),
    extractFunctionSource(serverSrc, "buildTeamfightPhases"),
    extractFunctionSource(serverSrc, "teamfightPhaseCoaching"),
    extractFunctionSource(serverSrc, "teamfightTakeaway"),
    extractFunctionSource(serverSrc, "mergeTeamfightCoaching"),
    "return { buildTeamfightPhases, teamfightPhaseCoaching, teamfightTakeaway, mergeTeamfightCoaching };",
  ].join("\n"),
)();
const { buildTeamfightPhases, teamfightPhaseCoaching, teamfightTakeaway, mergeTeamfightCoaching } = env;

let pass = 0, fail = 0;
function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}
function checkTrue(label, cond) { console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); cond ? pass++ : fail++; }

const ev = (eventId, t, eventType, label) => ({ eventId, timestampMs: t, timestampLabel: label, eventType, isPlayerInvolved: true });
const enc = (id, ids, over = {}) => ({ encounterId: id, phase: "MID", eventCount: ids.length, playerKills: 0, playerDeaths: 0, situation: "TRADED", relatedEventIds: ids, startLabel: "", endLabel: "", ...over });

const tf1Events = [ev("a", 10000, "CHAMPION_KILL", "0:10"), ev("b", 15000, "PLAYER_DEATH", "0:15"), ev("c", 18000, "CHAMPION_KILL", "0:18")];
const tf1 = buildTeamfightPhases([enc("enc_001", ["a", "b", "c"], { situation: "PLAYER_DOMINANT", playerKills: 2, playerDeaths: 1 })], tf1Events);
check("TF1 단일 한타", tf1.length, 1);
check("TF1 단계 3개", tf1[0].phases.map((p) => p.phase), ["ENGAGE", "TRADE", "CLEANUP"]);
check("TF1 outcomeTags", tf1[0].phases.map((p) => p.outcomeTag), ["INITIATED_KILL", "TRADE_LOST", "CLOSED_OUT"]);
check("TF1 teamfightId/gamePhase", [tf1[0].teamfightId, tf1[0].gamePhase], ["enc_001", "MID"]);
check("TF1 단계 K/D", tf1[0].phases.map((p) => [p.playerKills, p.playerDeaths]), [[1, 0], [0, 1], [1, 0]]);

const tf2Events = [ev("a", 120000, "PLAYER_DEATH", "2:00"), ev("b", 125000, "CHAMPION_KILL", "2:05"), ev("c", 128000, "PLAYER_DEATH", "2:08")];
const tf2 = buildTeamfightPhases([enc("enc_002", ["a", "b", "c"])], tf2Events);
check("TF2 outcomeTags (추격사: 킬 직후 데스)", tf2[0].phases.map((p) => p.outcomeTag), ["CAUGHT_OUT", "TRADE_WON", "OVERCHASE_DEATH"]);

const tf3Events = [ev("a", 180000, "CHAMPION_KILL", "3:00"), ev("b", 183000, "PLAYER_DEATH", "3:03"), ev("c", 185000, "PLAYER_DEATH", "3:05")];
const tf3 = buildTeamfightPhases([enc("enc_003", ["a", "b", "c"])], tf3Events);
check("TF3 cleanup DIED_IN_FIGHT", tf3[0].phases[2].outcomeTag, "DIED_IN_FIGHT");

const tf4Events = [ev("a", 240000, "PLAYER_DEATH", "4:00"), ev("b", 243000, "PLAYER_DEATH", "4:03"), ev("c", 260000, "PLAYER_DEATH", "4:20")];
const tf4 = buildTeamfightPhases([enc("enc_004", ["a", "b", "c"])], tf4Events);
check("TF4 cleanup OVERCHASE_DEATH (간격>8s)", tf4[0].phases[2].outcomeTag, "OVERCHASE_DEATH");

const small = buildTeamfightPhases([enc("enc_005", ["a", "b"])], [ev("a", 1, "CHAMPION_KILL", "0:01"), ev("b", 2, "PLAYER_DEATH", "0:02")]);
check("eventCount<3 제외", small.length, 0);

for (const tag of ["INITIATED_KILL", "CAUGHT_OUT", "TRADE_WON", "TRADE_LOST", "TRADE_EVEN", "CLOSED_OUT", "OVERCHASE_DEATH", "DIED_IN_FIGHT"]) {
  checkTrue(`coaching(${tag}) 비어있지 않음`, typeof teamfightPhaseCoaching(tag) === "string" && teamfightPhaseCoaching(tag).length > 0);
}

const tfCaught = buildTeamfightPhases([enc("enc_006", ["a", "b", "c"])], tf2Events);
check("takeaway CAUGHT_OUT 우선", teamfightTakeaway(tfCaught[0]), "한타 진입 전 시야와 포지션을 먼저 잡아 선제 피해를 줄이자.");

const merged = mergeTeamfightCoaching(tf1, [{ teamfightId: "enc_001", phases: [{ phase: "ENGAGE", coaching: "AI 진입 코칭" }], takeaway: "AI 교훈" }]);
check("merge AI engage coaching", merged[0].phases[0].coaching, "AI 진입 코칭");
check("merge 룰 trade coaching", merged[0].phases[1].coaching, teamfightPhaseCoaching("TRADE_LOST"));
check("merge AI takeaway", merged[0].takeaway, "AI 교훈");
const mergedNoAi = mergeTeamfightCoaching(tf1, []);
check("merge AI 없음 → 룰 takeaway", mergedNoAi[0].takeaway, teamfightTakeaway(tf1[0]));
checkTrue("merge AI 없음 → 룰 coaching 채움", mergedNoAi[0].phases.every((p) => p.coaching.length > 0));

// TRADE_EVEN + N>3 (4-event: ENGAGE=KILL, TRADE=[KILL,DEATH]→even, CLEANUP=KILL)
const tf5Events = [ev("a", 300000, "CHAMPION_KILL", "5:00"), ev("b", 302000, "CHAMPION_KILL", "5:02"), ev("c", 305000, "PLAYER_DEATH", "5:05"), ev("d", 307000, "CHAMPION_KILL", "5:07")];
const tf5 = buildTeamfightPhases([enc("enc_007", ["a", "b", "c", "d"])], tf5Events);
check("TF5 N>3 단계 3개", tf5[0].phases.map((p) => p.phase), ["ENGAGE", "TRADE", "CLEANUP"]);
check("TF5 TRADE 2이벤트 even", [tf5[0].phases[1].relatedEventIds.length, tf5[0].phases[1].outcomeTag], [2, "TRADE_EVEN"]);

// teamfightTakeaway 분기 하드코딩 단언 (순환 비교 제거)
check("takeaway PLAYER_DOMINANT", teamfightTakeaway(tf1[0]), "좋은 한타 흐름을 다음에도 반복하자.");
const tfDefault = buildTeamfightPhases([enc("enc_008", ["a", "b", "c"])], tf1Events);
check("takeaway default", teamfightTakeaway(tfDefault[0]), "한타 국면별 판단을 점검해 다음 교전에 적용하자.");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
