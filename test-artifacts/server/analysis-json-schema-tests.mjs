import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ANALYSIS_OUTPUT_SCHEMA } = require("../../lib/analysis-json-schema.js");

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass += 1;
    console.log(`PASS  ${name}`);
  } catch (err) {
    fail += 1;
    console.log(`FAIL  ${name}: ${err.message}`);
  }
}

// 구조화 출력이 지원하지 않는 키워드를 스키마 어디에도 쓰지 않았는지 재귀 확인.
const UNSUPPORTED = ["minimum", "maximum", "multipleOf", "minLength", "maxLength", "minItems", "maxItems", "$ref", "$defs"];

function walk(node, visit, path = "$") {
  if (node === null || typeof node !== "object") return;
  visit(node, path);
  for (const [k, v] of Object.entries(node)) walk(v, visit, `${path}.${k}`);
}

test("schema uses no unsupported JSON Schema keywords", () => {
  const found = [];
  walk(ANALYSIS_OUTPUT_SCHEMA, (node, path) => {
    for (const kw of UNSUPPORTED) {
      if (Object.prototype.hasOwnProperty.call(node, kw)) found.push(`${path}.${kw}`);
    }
  });
  assert.deepEqual(found, [], `unsupported keywords: ${found.join(", ")}`);
});

test("every object sets additionalProperties false", () => {
  const bad = [];
  walk(ANALYSIS_OUTPUT_SCHEMA, (node, path) => {
    if (node.type === "object" && node.additionalProperties !== false) bad.push(path);
  });
  assert.deepEqual(bad, [], `objects missing additionalProperties:false: ${bad.join(", ")}`);
});

test("top level requires the 13 documented fields", () => {
  assert.equal(ANALYSIS_OUTPUT_SCHEMA.type, "object");
  for (const field of [
    "schemaVersion", "analysisMeta", "matchSummary", "coachSummary",
    "phaseSummaries", "strengths", "weaknesses", "actionChecklist",
    "keyMoments", "evidenceIndex", "combatAnalysis",
    "teamfightPhaseAnalysis", "teamplayAnalysisV2",
  ]) {
    assert.ok(field in ANALYSIS_OUTPUT_SCHEMA.properties, `missing property: ${field}`);
  }
});

// additionalProperties:false는 properties에 없는 키를 금지한다. 즉 스키마에서 필드
// 하나를 빠뜨리면 구조화 출력이 지금 잘 나오던 필드를 막아버린다. 위 세 테스트는
// 형식만 보므로 이 함정을 못 잡는다. 저장된 실제 AI 응답을 스키마에 대고 훑어
// 미지 키를 찾는다.
//
// server.js가 파싱 후 사후 기록하는 필드는 모델이 만들지 않으므로 제외한다.
const SERVER_ADDED = new Set(["schemaViolations", "schemaViolationCount"]);

function collectUnknownKeys(value, schema, path, out) {
  if (value === null || value === undefined || !schema) return;

  if (schema.type === "array") {
    if (!Array.isArray(value)) return; // 타입 위반은 validateAnalysisOutput 담당
    value.forEach((item, i) => collectUnknownKeys(item, schema.items, `${path}[${i}]`, out));
    return;
  }

  if (schema.type === "object") {
    if (typeof value !== "object" || Array.isArray(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (SERVER_ADDED.has(key)) continue;
      const childSchema = schema.properties?.[key];
      if (!childSchema) {
        out.add(`${path}.${key}`);
        continue;
      }
      collectUnknownKeys(child, childSchema, `${path}.${key}`, out);
    }
  }
}

test("schema admits every key present in the stored AI analyses", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = new URL("../../data/samples/", import.meta.url).pathname;

  const unknown = new Set();
  let analyses = 0;

  for (const dir of fs.readdirSync(root)) {
    const file = path.join(root, dir, "comparison-result.json");
    if (!fs.existsSync(file)) continue;
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const analysis of [parsed.claudeAnalysis, parsed.codexAnalysis]) {
      if (!analysis || typeof analysis !== "object") continue;
      analyses += 1;
      collectUnknownKeys(analysis, ANALYSIS_OUTPUT_SCHEMA, "$", unknown);
    }
  }

  assert.ok(analyses > 0, "no stored analyses found — this test would be vacuous");
  assert.deepEqual(
    [...unknown].sort(),
    [],
    `schema would forbid keys the model already emits: ${[...unknown].sort().join(", ")}`,
  );
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
