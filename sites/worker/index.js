const SAMPLE_DETAIL_PREFIX = "/api/samples/";
const READ_ONLY_ENDPOINTS = new Set([
  "/api/demo-auth",
  "/api/recent-matches",
  "/api/champion-history",
  "/api/generate-sample",
]);
const sampleIdPattern = /^sample-[a-z0-9-]+$/;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function readOnlyResponse() {
  return json(
    {
      ok: false,
      code: "PUBLIC_DEMO_READONLY",
      error:
        "외부 데모 모드에서는 라이브 Riot API/샘플 생성 기능이 비활성화되어 있습니다.",
    },
    403,
  );
}

function assetRequest(request, publicPath) {
  const assetUrl = new URL(publicPath, request.url);
  return new Request(assetUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
}

async function readJsonAsset(request, env, publicPath) {
  const response = await env.ASSETS.fetch(assetRequest(request, publicPath));
  if (!response.ok) {
    const error = new Error(`Asset request failed: ${publicPath}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function readOptionalJsonAsset(request, env, publicPath) {
  const response = await env.ASSETS.fetch(assetRequest(request, publicPath));
  if (response.status === 404) return null;
  if (!response.ok) {
    const error = new Error(`Asset request failed: ${publicPath}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function publicManifest(manifest) {
  return {
    ...manifest,
    samples: (manifest.samples || []).map(({ matchId: _matchId, notesPath: _notesPath, ...sample }) =>
      sample
    ),
  };
}

function validSampleAssetPath(sample, publicPath, basename) {
  return publicPath === `/data/samples/${sample.id}/${basename}`;
}

async function loadManifest(request, env) {
  const manifest = await readJsonAsset(request, env, "/data/samples/manifest.json");
  if (!manifest || !Array.isArray(manifest.samples)) {
    throw new Error("Invalid staged sample manifest.");
  }
  return publicManifest(manifest);
}

async function handleSampleDetail(request, env, pathname) {
  const sampleId = pathname.slice(SAMPLE_DETAIL_PREFIX.length);
  if (!sampleIdPattern.test(sampleId)) {
    return json(
      { ok: false, code: "INVALID_SAMPLE_ID", error: "샘플 ID가 올바르지 않습니다." },
      400,
    );
  }

  const manifest = await loadManifest(request, env);
  const sample = manifest.samples.find((entry) => entry.id === sampleId);
  if (!sample) {
    return json({ ok: false, error: "Sample not found." }, 404);
  }
  if (
    !validSampleAssetPath(sample, sample.normalizedPath, "normalized-match.json") ||
    !validSampleAssetPath(sample, sample.analysisPath, "analysis-result.json")
  ) {
    throw new Error("Invalid staged sample path.");
  }

  const comparisonPath = sample.normalizedPath.replace(
    /normalized-match\.json$/,
    "comparison-result.json",
  );
  const [normalized, analysis, comparison] = await Promise.all([
    readJsonAsset(request, env, sample.normalizedPath),
    readJsonAsset(request, env, sample.analysisPath),
    readOptionalJsonAsset(request, env, comparisonPath),
  ]);

  return json({
    sampleId: sample.id,
    publicAlias: sample.publicAlias,
    collectedDate: sample.collectedDate,
    theme: sample.theme,
    normalized,
    analysis,
    comparison,
  });
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/healthz") {
        return json({
          ok: true,
          service: "lol-replay-coach",
          publicDemoMode: "readonly",
          publicDemoModeValid: true,
          publicDemoTokenConfigured: false,
          publicDemoTokenValid: true,
          readonly: true,
          protected: false,
          sampleGeneration: { activeCount: 0, oldestAgeMs: 0 },
          timestamp: new Date().toISOString(),
        });
      }

      if (url.pathname === "/api/samples" && request.method === "GET") {
        return json(await loadManifest(request, env));
      }

      if (url.pathname.startsWith(SAMPLE_DETAIL_PREFIX) && request.method === "GET") {
        return handleSampleDetail(request, env, url.pathname);
      }

      if (READ_ONLY_ENDPOINTS.has(url.pathname)) {
        return readOnlyResponse();
      }

      if (url.pathname.startsWith("/api/") || url.pathname === "/healthz") {
        return json({ ok: false, error: "Not found." }, 404);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Sites worker request failed", error);
      return json(
        { ok: false, code: "INTERNAL_SERVER_ERROR", error: "서버 처리 중 오류가 발생했습니다." },
        500,
      );
    }
  },
};

export default worker;
