// Stored sample manifest integrity tests.
//
// External read-only demos depend on these bundles. If a manifest entry points
// to a missing report file, the demo can load but fail at the first sample click.

import fs from "fs";

const root = new URL("../..", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL("../../data/samples/manifest.json", import.meta.url), "utf8"));
const samples = Array.isArray(manifest.samples) ? manifest.samples : [];

let pass = 0;
let fail = 0;

function check(label, condition, detail = "") {
  const ok = Boolean(condition);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok && detail) console.log(`  ${detail}`);
  ok ? pass++ : fail++;
}

function localPathFromPublicPath(publicPath) {
  return new URL(`../../${String(publicPath || "").replace(/^\/+/, "")}`, import.meta.url);
}

const ids = samples.map((sample) => sample.id);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
const requiredEntryFields = ["id", "matchId", "label", "champion", "publicAlias", "collectedDate", "theme", "normalizedPath", "analysisPath", "notesPath"];
const missingFieldEntries = samples.flatMap((sample) =>
  requiredEntryFields
    .filter((field) => !sample[field])
    .map((field) => `${sample.id || "(missing id)"}:${field}`),
);
const missingFiles = [];
const invalidPublicPaths = [];
const rawExposures = [];
const invalidBundles = [];

for (const sample of samples) {
  for (const key of ["normalizedPath", "analysisPath", "notesPath"]) {
    const publicPath = sample[key];
    if (typeof publicPath !== "string" || !publicPath.startsWith(`/data/samples/${sample.id}/`)) {
      invalidPublicPaths.push(`${sample.id}:${key}:${publicPath}`);
      continue;
    }
    if (/raw-|manifest\.json/.test(publicPath)) {
      rawExposures.push(`${sample.id}:${key}:${publicPath}`);
    }
    const fileUrl = localPathFromPublicPath(publicPath);
    if (!fs.existsSync(fileUrl)) {
      missingFiles.push(`${sample.id}:${key}:${publicPath}`);
    }
  }

  try {
    const normalized = JSON.parse(fs.readFileSync(localPathFromPublicPath(sample.normalizedPath), "utf8"));
    const analysis = JSON.parse(fs.readFileSync(localPathFromPublicPath(sample.analysisPath), "utf8"));
    if (!normalized.matchInfo?.champion || !normalized.matchInfo?.result) {
      invalidBundles.push(`${sample.id}:normalized.matchInfo`);
    }
    if (!analysis.matchSummary || !analysis.coachSummary) {
      invalidBundles.push(`${sample.id}:analysis summary`);
    }
  } catch (error) {
    invalidBundles.push(`${sample.id}:${error.message}`);
  }
}

check("manifest exposes samples array", Array.isArray(manifest.samples));
check("manifest keeps at least 19 stored samples", samples.length >= 19, `count=${samples.length}`);
check("sample ids are unique", duplicateIds.length === 0, duplicateIds.join(", "));
check("sample entries include required metadata", missingFieldEntries.length === 0, missingFieldEntries.slice(0, 10).join(", "));
check("manifest paths stay under each sample directory", invalidPublicPaths.length === 0, invalidPublicPaths.slice(0, 10).join(", "));
check("manifest does not expose raw payload paths", rawExposures.length === 0, rawExposures.slice(0, 10).join(", "));
check("manifest referenced files exist", missingFiles.length === 0, missingFiles.slice(0, 10).join(", "));
check("normalized and analysis bundles have report essentials", invalidBundles.length === 0, invalidBundles.slice(0, 10).join(", "));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
