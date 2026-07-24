import assert from "node:assert/strict";
import test from "node:test";

import worker from "../worker/index.js";

const internalServerError = {
  ok: false,
  code: "INTERNAL_SERVER_ERROR",
  error: "서버 처리 중 오류가 발생했습니다.",
};

function assetsServing(files) {
  return {
    async fetch(request) {
      const { pathname } = new URL(request.url);
      if (!Object.hasOwn(files, pathname)) {
        return new Response("not found", { status: 404 });
      }
      return new Response(JSON.stringify(files[pathname]), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    },
  };
}

// worker 는 실패를 삼키지 않고 로깅하도록 설계돼 있으므로, 오류 경로 테스트에서는
// 의도된 console.error 가 테스트 출력을 더럽히지 않게 잠시 가로챈다.
async function withSilencedErrorLog(run) {
  const original = console.error;
  const calls = [];
  console.error = (...args) => calls.push(args);
  try {
    return { result: await run(), calls };
  } finally {
    console.error = original;
  }
}

test("sample detail failures return a JSON 500 instead of rejecting", async () => {
  const env = {
    ASSETS: assetsServing({
      "/data/samples/manifest.json": {
        schemaVersion: 1,
        samples: [
          {
            id: "sample-kr-1",
            // 스테이징 계약을 깬 경로 → handleSampleDetail 이 throw 한다.
            normalizedPath: "/data/samples/sample-kr-1/normalized-match.json",
            analysisPath: "/elsewhere/analysis-result.json",
          },
        ],
      },
    }),
  };

  const { result: response, calls } = await withSilencedErrorLog(() =>
    worker.fetch(new Request("https://example.com/api/samples/sample-kr-1"), env),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), internalServerError);
  assert.equal(calls.length, 1, "the failure must still be logged");
});

test("the sample list never exposes player identity fields", async () => {
  const env = {
    ASSETS: assetsServing({
      "/data/samples/manifest.json": {
        schemaVersion: 1,
        samples: [
          {
            id: "sample-kr-1",
            label: "sample-kr-1",
            champion: "Seraphine",
            matchId: "KR_1234567890",
            notesPath: "/data/samples/sample-kr-1/notes.md",
            publicAlias: "테스트 소환사#KR1",
            normalizedPath: "/data/samples/sample-kr-1/normalized-match.json",
            analysisPath: "/data/samples/sample-kr-1/analysis-result.json",
          },
        ],
      },
    }),
  };

  const response = await worker.fetch(new Request("https://example.com/api/samples"), env);
  assert.equal(response.status, 200);

  const [sample] = (await response.json()).samples;
  assert.ok(!Object.hasOwn(sample, "matchId"), "must not expose matchId");
  assert.ok(!Object.hasOwn(sample, "notesPath"), "must not expose notesPath");
  assert.ok(!Object.hasOwn(sample, "publicAlias"), "must not expose publicAlias");
  assert.equal(sample.label, "sample-kr-1", "non-identifying fields must survive");
});

test("static asset failures return a JSON 500 instead of rejecting", async () => {
  const env = {
    ASSETS: {
      async fetch() {
        throw new Error("asset backend unavailable");
      },
    },
  };

  const { result: response, calls } = await withSilencedErrorLog(() =>
    worker.fetch(new Request("https://example.com/"), env),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), internalServerError);
  assert.equal(calls.length, 1, "the failure must still be logged");
});
