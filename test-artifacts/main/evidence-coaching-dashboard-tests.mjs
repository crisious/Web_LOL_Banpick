// Evidence-first coaching dashboard behavior contracts.
//
// This is intentionally a zero-dependency test. It evaluates main.js without
// starting the browser app, then exercises the new pure dashboard helpers
// against the real Rell support sample used by the selected design.

import fs from "node:fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");
const normalized = JSON.parse(
  fs.readFileSync(
    new URL("../../data/samples/sample-kr-8245229143/normalized-match.json", import.meta.url),
    "utf8",
  ),
);
const analysis = JSON.parse(
  fs.readFileSync(
    new URL("../../data/samples/sample-kr-8245229143/analysis-result.json", import.meta.url),
    "utf8",
  ),
);

const sample = {
  sampleId: "sample-kr-8245229143",
  normalized,
  analysis,
};

let pass = 0;
let fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) {
    console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  }
  ok ? pass++ : fail++;
}

function checkTrue(label, condition, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${condition || !detail ? "" : `  — ${detail}`}`);
  condition ? pass++ : fail++;
}

function safeCall(fn, ...args) {
  if (typeof fn !== "function") {
    return { value: null, error: "helper is not defined" };
  }
  try {
    return { value: fn(...args), error: "" };
  } catch (error) {
    return { value: null, error: error?.stack || String(error) };
  }
}

function sectionWithHook(html, hook) {
  const hookIndex = String(html || "").indexOf(hook);
  if (hookIndex < 0) return "";
  const start = String(html).lastIndexOf("<section", hookIndex);
  const end = String(html).indexOf("</section>", hookIndex);
  if (start < 0 || end < 0) return "";
  return String(html).slice(start, end + "</section>".length);
}

// Evaluate all of main.js so newly added helpers may freely use existing pure
// utilities such as formatPercent(), escapeHtml(), and escapeAttr(). The final
// init() call is removed so no server or browser lifecycle starts.
function loadDashboardRuntime() {
  const sourceWithoutInit = mainSrc.replace(/\ninit\(\);\s*$/, "");
  const documentStub = {
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const storageStub = {
    getItem() { return null; },
    setItem() {},
    removeItem() {},
  };

  try {
    const value = new Function(
      "document",
      "window",
      "sessionStorage",
      "localStorage",
      `${sourceWithoutInit}
return {
  buildEvidenceDashboardMetrics:
    typeof buildEvidenceDashboardMetrics === "function" ? buildEvidenceDashboardMetrics : null,
  buildEvidenceMomentModels:
    typeof buildEvidenceMomentModels === "function" ? buildEvidenceMomentModels : null,
  renderEvidenceMomentDetail:
    typeof renderEvidenceMomentDetail === "function" ? renderEvidenceMomentDetail : null,
};`,
    )(documentStub, {}, storageStub, storageStub);
    return { value, error: "" };
  } catch (error) {
    return { value: null, error: error?.stack || String(error) };
  }
}

const runtimeResult = loadDashboardRuntime();
const runtime = runtimeResult.value || {};

checkTrue("dashboard helper runtime loads without starting init", Boolean(runtimeResult.value), runtimeResult.error);
checkTrue(
  "main defines buildEvidenceDashboardMetrics",
  typeof runtime.buildEvidenceDashboardMetrics === "function",
);
checkTrue(
  "main defines buildEvidenceMomentModels",
  typeof runtime.buildEvidenceMomentModels === "function",
);
checkTrue(
  "main defines renderEvidenceMomentDetail",
  typeof runtime.renderEvidenceMomentDetail === "function",
);

// ── Source-backed headline metrics ────────────────────────────────────────
const metricsResult = safeCall(runtime.buildEvidenceDashboardMetrics, sample);
checkTrue("source-backed metrics helper executes", !metricsResult.error, metricsResult.error);
check("source-backed metrics use the selected sample", metricsResult.value, {
  score: 47,
  kda: "0 / 11 / 13",
  vision: 133,
  killParticipation: "45%",
});

const alternateSample = JSON.parse(JSON.stringify(sample));
alternateSample.normalized.playtimeScore.overall = 6.7;
alternateSample.normalized.playerStats = {
  ...alternateSample.normalized.playerStats,
  kills: 7,
  deaths: 1,
  assists: 9,
  visionScore: 31,
  killParticipation: 0.62,
};
const alternateMetrics = safeCall(runtime.buildEvidenceDashboardMetrics, alternateSample);
checkTrue("alternate metrics helper executes", !alternateMetrics.error, alternateMetrics.error);
check("metrics are data-driven rather than copied from the mockup", alternateMetrics.value, {
  score: 67,
  kda: "7 / 1 / 9",
  vision: 31,
  killParticipation: "62%",
});

// ── Four-moment selection model ──────────────────────────────────────────
const modelsResult = safeCall(runtime.buildEvidenceMomentModels, sample);
checkTrue("evidence moment model helper executes", !modelsResult.error, modelsResult.error);

const modelBundle = modelsResult.value;
const moments = Array.isArray(modelBundle?.moments) ? modelBundle.moments : [];
check("dashboard keeps the committed sample's four review moments in source order", moments.map((moment) => moment.id), [
  "km_1",
  "km_2",
  "km_3",
  "km_4",
]);
check("first source-backed danger moment is selected by default", modelBundle?.selectedId ?? null, "km_1");
check("selected moments preserve source time and semantic tone", moments.map((moment) => ({
  id: moment.id,
  timestampLabel: moment.timestampLabel,
  tone: moment.tone,
})), [
  { id: "km_1", timestampLabel: "4:16", tone: "danger" },
  { id: "km_2", timestampLabel: "7:43", tone: "good" },
  { id: "km_3", timestampLabel: "24:54", tone: "danger" },
  { id: "km_4", timestampLabel: "35:48", tone: "danger" },
]);

const selectedMoment = moments.find((moment) => moment.id === modelBundle?.selectedId);
check("selected moment facts come from related timeline event IDs", selectedMoment?.observedFacts?.map((fact) => fact.eventId) ?? [], ["evt_001"]);
check(
  "selected moment interpretation is the AI key-moment description",
  selectedMoment?.interpretation ?? null,
  analysis.keyMoments.find((moment) => moment.id === "km_1")?.description,
);

const selectedRelatedIds = new Set(
  analysis.keyMoments.find((moment) => moment.id === "km_1")?.relatedEventIds || [],
);
checkTrue(
  "observed facts contain no event outside relatedEventIds",
  Boolean(selectedMoment) &&
    Array.isArray(selectedMoment.observedFacts) &&
    selectedMoment.observedFacts.every((fact) => selectedRelatedIds.has(fact.eventId)),
);

// ── Observed fact / AI interpretation rendering boundary ─────────────────
const detailResult = safeCall(runtime.renderEvidenceMomentDetail, selectedMoment);
checkTrue("selected evidence detail renders", !detailResult.error, detailResult.error);
const selectedDetailHtml = detailResult.value || "";
const observedHtml = sectionWithHook(selectedDetailHtml, "data-evidence-observed");
const interpretationHtml = sectionWithHook(selectedDetailHtml, "data-evidence-interpretation");
const sourceFact = normalized.timelineEvents.find((event) => event.eventId === "evt_001")?.summary || "";
const sourceInterpretation = analysis.keyMoments.find((moment) => moment.id === "km_1")?.description || "";

checkTrue("detail renders a labeled observed-fact section", observedHtml.includes("관찰된 사실"));
checkTrue("detail renders a labeled AI-interpretation section", interpretationHtml.includes("AI 해석"));
checkTrue("observed section renders linked normalized timeline copy", observedHtml.includes(sourceFact));
checkTrue(
  "observed section does not contain AI interpretation",
  Boolean(observedHtml) && !observedHtml.includes(sourceInterpretation),
);
checkTrue("AI section renders key-moment interpretation", interpretationHtml.includes(sourceInterpretation));
checkTrue(
  "AI section does not relabel a timeline sentence as interpretation",
  Boolean(interpretationHtml) && !interpretationHtml.includes(sourceFact),
);

// ── Missing linked evidence remains explicit and non-invented ─────────────
const missingEvidenceSample = {
  normalized: { timelineEvents: [] },
  analysis: {
    keyMoments: [
      {
        id: "km_missing",
        timestampLabel: "9:99",
        phase: "EARLY",
        title: "연결 기록이 없는 장면",
        description: "AI 해석은 존재합니다.",
        relatedEventIds: ["evt_missing"],
      },
    ],
  },
};
const missingModelsResult = safeCall(runtime.buildEvidenceMomentModels, missingEvidenceSample);
checkTrue("missing-evidence model helper executes", !missingModelsResult.error, missingModelsResult.error);
const missingMoment = missingModelsResult.value?.moments?.[0];
check("missing evidence produces an empty observed-fact list", missingMoment?.observedFacts ?? null, []);
const missingDetailResult = safeCall(runtime.renderEvidenceMomentDetail, missingMoment);
checkTrue("missing-evidence detail renderer executes", !missingDetailResult.error, missingDetailResult.error);
const missingDetailHtml = missingDetailResult.value || "";
checkTrue("missing evidence renders the explicit source fallback", missingDetailHtml.includes("원본 이벤트 기록 없음"));
checkTrue("missing evidence keeps the AI interpretation separate", missingDetailHtml.includes("AI 해석은 존재합니다."));

// ── Both server-fed text channels are escaped at the display boundary ─────
const unsafeMoment = {
  id: 'km_bad"><img src=x onerror=alert(1)>',
  timestampLabel: '15:48"><img src=x onerror=alert(2)>',
  phase: "MID",
  title: "장면 <img src=x onerror=alert(3)>",
  tone: "danger",
  observedFacts: [
    {
      eventId: 'evt_bad"><img src=x onerror=alert(4)>',
      timestampLabel: "15:48",
      eventType: "PLAYER_DEATH",
      summary: "관찰 <img src=x onerror=alert(5)>",
    },
  ],
  interpretation: "AI <script>alert(6)</script>",
};
const unsafeDetailResult = safeCall(runtime.renderEvidenceMomentDetail, unsafeMoment);
checkTrue("unsafe evidence detail renderer executes", !unsafeDetailResult.error, unsafeDetailResult.error);
const unsafeHtml = unsafeDetailResult.value || "";
checkTrue("observed fact markup is escaped", unsafeHtml.includes("관찰 &lt;img src=x onerror=alert(5)&gt;"));
checkTrue("AI interpretation markup is escaped", unsafeHtml.includes("AI &lt;script&gt;alert(6)&lt;/script&gt;"));
checkTrue(
  "detail renders no raw injected img element",
  Boolean(unsafeHtml) && !unsafeHtml.includes("<img"),
);
checkTrue(
  "detail renders no raw injected script element",
  Boolean(unsafeHtml) && !unsafeHtml.includes("<script"),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
