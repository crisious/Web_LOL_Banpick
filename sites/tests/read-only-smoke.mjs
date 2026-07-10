import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testsRoot = path.dirname(fileURLToPath(import.meta.url));
const sitesRoot = path.resolve(testsRoot, "..");
const repoRoot = path.resolve(sitesRoot, "..");
const stagingScript = path.join(sitesRoot, "scripts", "stage-assets.mjs");
const workerEntry = path.join(sitesRoot, "dist", "server", "index.js");

const requiredUiAssets = ["index.html", "styles.css", "main.js", "og.png"];
const allowedSampleBasenames = new Set([
  "normalized-match.json",
  "analysis-result.json",
  "comparison-result.json",
]);

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function listFiles(root, relative = "") {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const nextRelative = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, nextRelative)));
    } else if (entry.isFile()) {
      files.push(nextRelative.split(path.sep).join("/"));
    }
  }

  return files.sort();
}

function stagedPathFromPublicPath(stageRoot, publicPath, sampleId, fieldName) {
  assert.equal(typeof publicPath, "string", `${sampleId}.${fieldName} must be a string`);
  assert.ok(
    publicPath.startsWith(`/data/samples/${sampleId}/`),
    `${sampleId}.${fieldName} must remain inside its sample directory`,
  );
  assert.ok(!publicPath.includes("\\"), `${sampleId}.${fieldName} must use URL separators`);
  assert.ok(!publicPath.includes("\0"), `${sampleId}.${fieldName} must not contain NUL bytes`);

  const relativePath = publicPath.slice(1);
  assert.equal(
    path.posix.normalize(relativePath),
    relativePath,
    `${sampleId}.${fieldName} must not contain traversal segments`,
  );

  const resolvedPath = path.resolve(stageRoot, relativePath);
  assert.ok(
    resolvedPath.startsWith(`${path.resolve(stageRoot)}${path.sep}`),
    `${sampleId}.${fieldName} must resolve inside the staging directory`,
  );
  return resolvedPath;
}

test("the explicit staging script creates a sanitized read-only Sites bundle", async (t) => {
  assert.ok(
    await isFile(stagingScript),
    `Missing explicit staging implementation: ${path.relative(repoRoot, stagingScript)}`,
  );

  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "lol-replay-coach-sites-stage-"));
  const stageRoot = path.join(temporaryRoot, "public");
  t.after(async () => {
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  const result = spawnSync(process.execPath, [stagingScript, stageRoot], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    0,
    [
      "The explicit staging script must exit successfully.",
      result.stdout && `stdout:\n${result.stdout}`,
      result.stderr && `stderr:\n${result.stderr}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  await t.test("stages the root UI assets byte-for-byte", async () => {
    for (const relativePath of requiredUiAssets) {
      const [source, staged] = await Promise.all([
        readFile(path.join(repoRoot, relativePath)),
        readFile(path.join(stageRoot, relativePath)),
      ]);
      assert.deepEqual(staged, source, `${relativePath} must be staged from the root UI`);
    }
  });

  const manifestPath = path.join(stageRoot, "data", "samples", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  await t.test("stages the committed sample inventory instead of dirty working-tree additions", () => {
    const committed = spawnSync("git", ["show", "HEAD:data/samples/manifest.json"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    assert.equal(committed.status, 0, committed.stderr || "unable to read committed manifest");
    const committedManifest = JSON.parse(committed.stdout);
    assert.deepEqual(
      manifest.samples.map((sample) => sample.id),
      committedManifest.samples.map((sample) => sample.id),
      "Sites staging must not publish uncommitted sample additions",
    );
  });

  await t.test("keeps every manifest asset path valid and staged", async () => {
    assert.ok(Array.isArray(manifest.samples), "manifest.samples must be an array");
    assert.ok(manifest.samples.length > 0, "at least one curated sample must be staged");

    for (const sample of manifest.samples) {
      assert.match(sample.id, /^sample-[a-z0-9-]+$/, "sample ids must be URL-safe");

      for (const fieldName of ["normalizedPath", "analysisPath"]) {
        const assetPath = stagedPathFromPublicPath(
          stageRoot,
          sample[fieldName],
          sample.id,
          fieldName,
        );
        assert.ok(await isFile(assetPath), `${sample.id}.${fieldName} must point to a staged file`);
        await assert.doesNotReject(
          () => readFile(assetPath, "utf8").then(JSON.parse),
          `${sample.id}.${fieldName} must point to valid JSON`,
        );
      }
    }
  });

  await t.test("includes only derived sample JSON needed by the read-only UI", async () => {
    const samplesRoot = path.join(stageRoot, "data", "samples");
    const stagedFiles = await listFiles(samplesRoot);
    const sampleFiles = stagedFiles.filter((relativePath) => relativePath !== "manifest.json");

    assert.ok(sampleFiles.length > 0, "derived sample files must be staged");
    for (const relativePath of sampleFiles) {
      assert.ok(
        allowedSampleBasenames.has(path.posix.basename(relativePath)),
        `unexpected sample artifact staged: ${relativePath}`,
      );
      assert.ok(relativePath.endsWith(".json"), `sample artifacts must be JSON: ${relativePath}`);
    }

    for (const sample of manifest.samples) {
      const comparisonPublicPath = sample.normalizedPath.replace(
        /normalized-match\.json$/,
        "comparison-result.json",
      );
      const sourceComparisonPath = path.join(repoRoot, comparisonPublicPath.slice(1));
      const stagedComparisonPath = path.join(stageRoot, comparisonPublicPath.slice(1));
      assert.equal(
        await isFile(stagedComparisonPath),
        await isFile(sourceComparisonPath),
        `${sample.id} comparison output must be copied only when present`,
      );
    }
  });

  await t.test("excludes raw payloads and notes", async () => {
    const stagedFiles = await listFiles(path.join(stageRoot, "data", "samples"));
    const forbidden = stagedFiles.filter(
      (relativePath) =>
        /(^|\/)raw-[^/]+\.json$/u.test(relativePath) ||
        /(^|\/)[^/]*notes[^/]*$/iu.test(relativePath) ||
        relativePath.endsWith(".md"),
    );
    assert.deepEqual(forbidden, [], `forbidden sample artifacts staged: ${forbidden.join(", ")}`);
  });

  await t.test("removes private identifiers from normalized sample payloads", async () => {
    for (const sample of manifest.samples) {
      const normalizedPath = stagedPathFromPublicPath(
        stageRoot,
        sample.normalizedPath,
        sample.id,
        "normalizedPath",
      );
      const normalized = JSON.parse(await readFile(normalizedPath, "utf8"));

      assert.ok(
        !Object.hasOwn(normalized.playerContext ?? {}, "puuid"),
        `${sample.id} must remove playerContext.puuid`,
      );
      assert.ok(
        !Object.hasOwn(normalized.playerContext ?? {}, "riotId"),
        `${sample.id} must remove playerContext.riotId`,
      );
      assert.ok(
        !Object.hasOwn(normalized.sourceMeta ?? {}, "rawMatchId"),
        `${sample.id} must remove sourceMeta.rawMatchId`,
      );
      assert.ok(
        !Object.hasOwn(normalized.matchInfo ?? {}, "matchId"),
        `${sample.id} must remove matchInfo.matchId`,
      );
    }
  });

  await t.test("removes private fields from the staged manifest", () => {
    for (const sample of manifest.samples) {
      assert.ok(!Object.hasOwn(sample, "matchId"), `${sample.id} must remove manifest matchId`);
      assert.ok(!Object.hasOwn(sample, "notesPath"), `${sample.id} must remove manifest notesPath`);
    }
  });
});

test("the Sites build contract emits dist/server/index.js", async () => {
  await access(sitesRoot);
  assert.ok(
    await isFile(workerEntry),
    `Missing Sites build output required by package-site.sh: ${path.relative(repoRoot, workerEntry)}`,
  );
});
