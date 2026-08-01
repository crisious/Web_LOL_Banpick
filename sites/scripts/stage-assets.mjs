import {
  copyFile,
  mkdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const sitesRoot = path.resolve(scriptsRoot, "..");
const appRoot = path.join(sitesRoot, "app");
const repoRoot = path.resolve(sitesRoot, "..");
const requestedOutput = process.argv[2] || path.join(sitesRoot, ".staging-public");
const outputRoot = path.resolve(process.cwd(), requestedOutput);
const temporaryOutputRoot = `${outputRoot}.tmp-${process.pid}`;

const uiAssets = [
  "index.html",
  "styles.css",
  "app.js",
  "coaching-plan.js",
  "og.png",
];

const sampleIdPattern = /^sample-[a-z0-9-]+$/;

function assertSafeOutputDirectory(directory) {
  const filesystemRoot = path.parse(directory).root;
  const forbidden = new Set([filesystemRoot, repoRoot, sitesRoot]);
  if (forbidden.has(directory)) {
    throw new Error(`Refusing to replace unsafe staging directory: ${directory}`);
  }
}

function validatedSampleAssetPath(sample, fieldName, expectedBasename) {
  const publicPath = sample[fieldName];
  if (typeof publicPath !== "string") {
    throw new Error(`${sample.id}.${fieldName} must be a string.`);
  }
  const expectedPath = `/data/samples/${sample.id}/${expectedBasename}`;
  if (publicPath !== expectedPath) {
    throw new Error(`${sample.id}.${fieldName} must equal ${expectedPath}.`);
  }

  const relativePath = publicPath.slice(1);
  if (path.posix.normalize(relativePath) !== relativePath || relativePath.includes("\\")) {
    throw new Error(`${sample.id}.${fieldName} contains an unsafe path.`);
  }

  const sourcePath = path.resolve(repoRoot, relativePath);
  if (!sourcePath.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error(`${sample.id}.${fieldName} resolves outside the repository.`);
  }
  return { publicPath, relativePath, sourcePath };
}

function sanitizeManifestSample(sample) {
  // publicAlias 는 이름과 달리 실제 Riot ID(Name#TAG)를 담고 있어 공개 번들에서 제외한다.
  const {
    matchId: _matchId,
    notesPath: _notesPath,
    publicAlias: _publicAlias,
    ...publicSample
  } = sample;
  return publicSample;
}

function sanitizeNormalized(normalized) {
  const sanitized = structuredClone(normalized);
  if (sanitized.playerContext && typeof sanitized.playerContext === "object") {
    delete sanitized.playerContext.puuid;
    delete sanitized.playerContext.riotId;
  }
  if (sanitized.sourceMeta && typeof sanitized.sourceMeta === "object") {
    delete sanitized.sourceMeta.rawMatchId;
  }
  if (sanitized.matchInfo && typeof sanitized.matchInfo === "object") {
    delete sanitized.matchInfo.matchId;
  }
  return sanitized;
}

const privateIdentifierKeys = new Set([
  "puuid",
  "riotId",
  "playerRiotId",
  "matchId",
  "rawMatchId",
  "summonerName",
  "gameName",
  "tagLine",
  "summonerId",
  "accountId",
]);

// analysis-result.json 은 analysisMeta.*, comparison-result.json 은
// claudeAnalysis.analysisMeta.* 로 같은 필드가 서로 다른 깊이에 있다.
// 경로를 지정하면 스키마가 한 겹 바뀔 때 조용히 새므로 키 기준으로 재귀 제거한다.
function stripPrivateIdentifiers(value) {
  if (Array.isArray(value)) return value.map(stripPrivateIdentifiers);
  if (!value || typeof value !== "object") return value;

  const cleaned = {};
  for (const [key, entry] of Object.entries(value)) {
    if (privateIdentifierKeys.has(key)) continue;
    cleaned[key] = stripPrivateIdentifiers(entry);
  }
  return cleaned;
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readCommittedFile(relativePath, { optional = false } = {}) {
  const gitPath = relativePath.split(path.sep).join("/");
  const result = spawnSync("git", ["show", `HEAD:${gitPath}`], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status === 0) return result.stdout;
  if (optional) return null;
  throw new Error(`Unable to read committed asset ${gitPath}: ${result.stderr.trim()}`);
}

async function stageSample(sample) {
  if (!sample || typeof sample !== "object" || !sampleIdPattern.test(sample.id || "")) {
    throw new Error(`Invalid sample id: ${sample?.id ?? "<missing>"}`);
  }

  const normalizedAsset = validatedSampleAssetPath(
    sample,
    "normalizedPath",
    "normalized-match.json",
  );
  const analysisAsset = validatedSampleAssetPath(
    sample,
    "analysisPath",
    "analysis-result.json",
  );

  const normalized = JSON.parse(readCommittedFile(normalizedAsset.relativePath));
  await writeJson(
    path.join(temporaryOutputRoot, normalizedAsset.relativePath),
    sanitizeNormalized(normalized),
  );
  const analysis = JSON.parse(readCommittedFile(analysisAsset.relativePath));
  await writeJson(
    path.join(temporaryOutputRoot, analysisAsset.relativePath),
    stripPrivateIdentifiers(analysis),
  );

  const comparisonRelativePath = normalizedAsset.relativePath.replace(
    /normalized-match\.json$/,
    "comparison-result.json",
  );
  const comparisonRaw = readCommittedFile(comparisonRelativePath, { optional: true });
  if (comparisonRaw != null) {
    await writeJson(
      path.join(temporaryOutputRoot, comparisonRelativePath),
      stripPrivateIdentifiers(JSON.parse(comparisonRaw)),
    );
  }
}

async function stage() {
  assertSafeOutputDirectory(outputRoot);
  await rm(temporaryOutputRoot, { recursive: true, force: true });
  await mkdir(temporaryOutputRoot, { recursive: true });

  for (const relativePath of uiAssets) {
    await copyFile(path.join(appRoot, relativePath), path.join(temporaryOutputRoot, relativePath));
  }

  const manifest = JSON.parse(readCommittedFile("data/samples/manifest.json"));
  if (!manifest || !Array.isArray(manifest.samples) || manifest.samples.length === 0) {
    throw new Error("Sample manifest must contain at least one sample.");
  }

  for (const sample of manifest.samples) {
    await stageSample(sample);
  }

  await writeJson(path.join(temporaryOutputRoot, "data", "samples", "manifest.json"), {
    ...manifest,
    samples: manifest.samples.map(sanitizeManifestSample),
  });

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(path.dirname(outputRoot), { recursive: true });
  await rename(temporaryOutputRoot, outputRoot);
  process.stdout.write(`${outputRoot}\n`);
}

try {
  await stage();
} catch (error) {
  await rm(temporaryOutputRoot, { recursive: true, force: true });
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
