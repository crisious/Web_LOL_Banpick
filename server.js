const http = require("http");
const https = require("https");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { URL } = require("url");
const { spawn } = require("child_process");
const {
  isValidSampleId,
  sampleManifestPublicPathToStorageRelativePath,
  validateManifest,
} = require("./lib/sample-manifest");

const root = __dirname;
loadEnvFile(path.join(root, ".env"));
const port = parsePortConfig(process.env.PORT);
const host = parseHostConfig(process.env.HOST);
const validPublicDemoModes = new Set(["full", "readonly", "protected"]);
const publicDemoModeConfig = parsePublicDemoModeConfig(process.env.PUBLIC_DEMO_MODE);
const publicDemoMode = publicDemoModeConfig.value;
const publicDemoModeValid = publicDemoModeConfig.valid;
const publicDemoTokenConfig = parsePublicDemoTokenConfig(process.env.PUBLIC_DEMO_TOKEN);
const publicDemoToken = publicDemoTokenConfig.value;
const publicDemoTokenValid = publicDemoTokenConfig.valid;
const trustProxy = parseTrustProxyConfig(process.env.TRUST_PROXY);
// Champions tab: Riot match-v5/ids?startTime 필터용 시즌 시작 epoch.
// S16 split 1 시작 시각 (Riot 패치노트 기준). 시즌 갱신 시 1회 업데이트.
const SEASON_START_EPOCH = Date.UTC(2026, 0, 9) / 1000;
// 오브젝트 처치 후 이 시간(ms) 내의 데스는 전략적으로 연관된 것으로 간주.
const POST_OBJECTIVE_DEATH_WINDOW_MS = 120000;
// 약점 판정용 "저파밍 바닥선" 분당 CS 임계값 (이 값 미만이면 자원 전환 약점으로 표시).
const CS_LOW_FARM_THRESHOLDS = { TOP: 6, MID: 6, ADC: 6.5, JUNGLE: 4.5, SUPPORT: 0 };
// calcIncomeScore 만점 기준선 — 의도적으로 저파밍 바닥선보다 높음 (점수 벤치마크 ≠ 약점 바닥선).
const CS_FULL_SCORE_TARGETS = { TOP: 6.5, MID: 7, ADC: 7.5, JUNGLE: 5, SUPPORT: 1.5 };
// 한타 단계별 분석: 이 이상 관여 이벤트면 '한타'로 간주.
const TEAMFIGHT_MIN_EVENTS = 3;
// 한타 정리 단계 추격사 판정용 시간 간격(ms).
const CLEANUP_GAP_MS = 8000;
// AI 출력 계약과 최종 validator가 공유하는 핵심 장면 최소 개수.
const KEY_MOMENTS_MIN = 4;
// AI 출력 계약과 최종 validator가 공유하는 단계 요약 최소 개수.
const PHASE_SUMMARIES_MIN = 3;
// evidenceIndex는 인사이트 근거 추적을 위해 최소 1개 이상을 검증한다.
const EVIDENCE_INDEX_MIN = 1;
// actionChecklist는 LLM 출력 계약과 코칭 체크리스트 UI에 맞춰 3~5개를 검증한다.
const ACTION_CHECKLIST_MIN = 3;
const ACTION_CHECKLIST_MAX = 5;
// strengths/weaknesses는 LLM 출력 계약과 리포트 카드 구조에 맞춰 정확히 3개를 검증한다.
const INSIGHT_LIST_MIN = 3;
const INSIGHT_LIST_MAX = 3;

function resolveSamplesDir(configuredDir, appRoot) {
  const value = configuredDir === undefined || configuredDir === null ? "" : String(configuredDir);
  if (value === "") {
    return path.join(appRoot, "data", "samples");
  }
  if (value.trim() !== value || /[\u0000-\u001F\u007F]/u.test(value)) {
    throw new Error("SAMPLES_DIR must be empty or a filesystem path without leading/trailing whitespace or control characters.");
  }
  return path.resolve(appRoot, value);
}

const samplesDir = resolveSamplesDir(process.env.SAMPLES_DIR, root);
const manifestPath = path.join(samplesDir, "manifest.json");
const manifestFileLockPath = path.join(samplesDir, ".manifest.lock");
const MANIFEST_FILE_LOCK_TIMEOUT_MS = 10000;
const MANIFEST_FILE_LOCK_RETRY_MS = 50;
const MANIFEST_FILE_LOCK_STALE_MS = 5 * 60 * 1000;
const SAMPLE_DETAIL_PATH_PREFIX = "/api/samples/";

function sampleStoragePath(sampleId, ...segments) {
  return path.join(samplesDir, sampleId, ...segments);
}

function sampleEntryStoragePath(publicPath) {
  const storageRelativePath = sampleManifestPublicPathToStorageRelativePath(publicPath);
  if (storageRelativePath) {
    return path.join(samplesDir, storageRelativePath);
  }
  const rawPath = String(publicPath || "");
  if (rawPath.startsWith("/data/samples/") || rawPath.startsWith("data/samples/")) {
    throw new Error(`Invalid sample manifest public path: ${rawPath}`);
  }
  const normalized = rawPath.replace(/^\//, "");
  return path.join(root, normalized);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const publicStaticPaths = new Set([
  "/",
  "/index.html",
  "/admin.html",
  "/styles.css",
  "/admin.css",
  "/main.js",
  "/admin.js",
  "/draft-state.js",
  "/favicon.ico",
]);

const blockedStaticPrefixes = [
  "/.",
  "/data/",
  "/docs/",
  "/scripts/",
  "/test-artifacts/",
  "/node_modules/",
  "/_design-mockups/",
];

const blockedStaticSuffixes = [
  ".md",
  ".ps1",
  ".mjs",
  ".log",
  ".env",
];

// ─── Simple in-memory rate limiter ───────────────────────────────────────────
const rateBuckets = new Map();
function rateLimit(key, windowMs) {
  const now = Date.now();
  const last = rateBuckets.get(key) || 0;
  if (now - last < windowMs) return false;
  rateBuckets.set(key, now);
  return true;
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) return value[0] || "";
  return String(value || "");
}

function tokenHeaderValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0 ? "\u0000invalid-duplicate-header" : "";
  }
  return String(value || "");
}

function proxyHeaderValue(value) {
  if (Array.isArray(value)) {
    return { value: "", duplicate: value.length > 0 };
  }
  return { value: String(value || ""), duplicate: false };
}

function parsePublicDemoModeConfig(rawMode) {
  const value = String(rawMode || "");
  if (!value) {
    return { value: "full", valid: true };
  }
  if (!validPublicDemoModes.has(value)) {
    return { value, valid: false };
  }
  return { value, valid: true };
}

function parsePublicDemoTokenConfig(rawToken) {
  const value = String(rawToken || "");
  if (!value || value.trim() === "") {
    return { value: "", valid: true };
  }
  if (value.trim() !== value || /\s/u.test(value)) {
    return { value: "", valid: false };
  }
  return { value, valid: true };
}

function parseTrustProxyConfig(rawTrustProxy) {
  return String(rawTrustProxy || "") === "1";
}

function parseAgentDisableCodexConfig(rawFlag) {
  return String(rawFlag || "") === "1";
}

function parseHostConfig(rawHost, defaultHost = "127.0.0.1") {
  const value = rawHost === undefined || rawHost === null ? "" : String(rawHost);
  if (value === "") {
    return defaultHost;
  }
  if (/\s/u.test(value) || /[\u0000-\u001F\u007F]/u.test(value)) {
    throw new Error("HOST must be empty or a hostname/IP literal without whitespace or control characters.");
  }
  return value;
}

function parsePortConfig(rawPort, defaultPort = 8123) {
  const value = rawPort === undefined || rawPort === null ? "" : String(rawPort);
  if (value === "") {
    return defaultPort;
  }
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error("PORT must be an exact decimal integer between 0 and 65535.");
  }
  const portNumber = Number(value);
  if (!Number.isSafeInteger(portNumber) || portNumber < 0 || portNumber > 65535) {
    throw new Error("PORT must be an exact decimal integer between 0 and 65535.");
  }
  return portNumber;
}

function parseRiotApiKeyConfig(rawKey) {
  const value = rawKey === undefined || rawKey === null ? "" : String(rawKey);
  if (value === "") {
    return "";
  }
  if (value.trim() !== value || /\s/u.test(value) || /[\u0000-\u001F\u007F]/u.test(value)) {
    return "";
  }
  if (!value.startsWith("RGAPI-") || value.length <= 20) {
    return "";
  }
  return value;
}

function parseExtraCliPathConfig(rawPath, delimiter = path.delimiter) {
  const value = rawPath === undefined || rawPath === null ? "" : String(rawPath);
  if (value === "") {
    return [];
  }
  const segments = value.split(delimiter);
  if (
    segments.some((segment) =>
      segment === "" ||
      segment.trim() !== segment ||
      /[\u0000-\u001F\u007F]/u.test(segment)
    )
  ) {
    throw new Error("EXTRA_CLI_PATH must be empty or a delimiter-separated list of non-empty paths without leading/trailing whitespace or control characters.");
  }
  return segments;
}

function getClientIp(req) {
  if (!trustProxy) {
    return req.socket.remoteAddress || "unknown";
  }

  const cfConnectingIp = proxyHeaderValue(req.headers["cf-connecting-ip"]);
  if (cfConnectingIp.duplicate) return req.socket.remoteAddress || "unknown";
  const cfConnectingIpValue = cfConnectingIp.value.trim();
  if (cfConnectingIpValue) return cfConnectingIpValue;

  const forwardedForHeader = proxyHeaderValue(req.headers["x-forwarded-for"]);
  if (forwardedForHeader.duplicate) return req.socket.remoteAddress || "unknown";
  const forwardedForRaw = forwardedForHeader.value;
  const forwardedForParts = forwardedForRaw.split(",").map((part) => part.trim());
  if (forwardedForRaw.trim() && forwardedForParts.some((part) => part === "")) {
    return req.socket.remoteAddress || "unknown";
  }
  const forwardedFor = forwardedForParts.filter(Boolean);
  if (forwardedFor.length > 0) return forwardedFor[0];

  const realIp = proxyHeaderValue(req.headers["x-real-ip"]);
  if (realIp.duplicate) return req.socket.remoteAddress || "unknown";
  const realIpValue = realIp.value.trim();
  if (realIpValue) return realIpValue;

  return req.socket.remoteAddress || "unknown";
}

function isReadOnlyDemoMode() {
  return publicDemoMode === "readonly";
}

function isProtectedDemoMode() {
  return publicDemoMode === "protected";
}

function isInvalidDemoMode() {
  return !publicDemoModeValid;
}

function publicDemoModeHealth() {
  return {
    publicDemoMode,
    publicDemoModeValid,
    publicDemoTokenValid,
    readonly: isReadOnlyDemoMode(),
    protected: isProtectedDemoMode(),
  };
}

function tokenFromRequest(req) {
  const auth = tokenHeaderValue(req.headers.authorization);
  const bearerPrefix = "Bearer ";
  if (auth.startsWith(bearerPrefix)) return auth.slice(bearerPrefix.length);
  if (auth) return "\u0000invalid-authorization";
  return tokenHeaderValue(req.headers["x-demo-token"]);
}

function sendDemoModeBlocked(res) {
  sendJson(res, 403, {
    ok: false,
    code: "PUBLIC_DEMO_READONLY",
    error: "외부 데모 모드에서는 라이브 Riot API/샘플 생성 기능이 비활성화되어 있습니다.",
  });
}

function sendDemoModeInvalid(res) {
  sendJson(res, 403, {
    ok: false,
    code: "PUBLIC_DEMO_MODE_INVALID",
    error: "PUBLIC_DEMO_MODE 값이 full, readonly, protected 중 하나가 아니라 live API를 차단했습니다.",
  });
}

function requireLiveApiAccess(req, res) {
  if (isReadOnlyDemoMode()) {
    sendDemoModeBlocked(res);
    return false;
  }

  if (isInvalidDemoMode()) {
    sendDemoModeInvalid(res);
    return false;
  }

  if (isProtectedDemoMode()) {
    if (!publicDemoTokenValid) {
      sendJson(res, 403, {
        ok: false,
        code: "PUBLIC_DEMO_TOKEN_INVALID",
        error: "보호 모드 PUBLIC_DEMO_TOKEN 값에 공백이 포함되어 live API를 차단했습니다.",
      });
      return false;
    }

    if (!publicDemoToken) {
      sendJson(res, 403, {
        ok: false,
        code: "PUBLIC_DEMO_TOKEN_REQUIRED",
        error: "보호 모드가 켜져 있지만 서버의 PUBLIC_DEMO_TOKEN이 설정되어 있지 않습니다.",
      });
      return false;
    }

    if (tokenFromRequest(req) !== publicDemoToken) {
      sendJson(res, 401, {
        ok: false,
        code: "PUBLIC_DEMO_UNAUTHORIZED",
        error: "외부 데모 보호 토큰이 필요합니다.",
      });
      return false;
    }
  }

  return true;
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (Object.prototype.hasOwnProperty.call(process.env, key)) {
      continue;
    }

    let value = rawValue;
    const hasDoubleQuotes = value.startsWith("\"") && value.endsWith("\"");
    const hasSingleQuotes = value.startsWith("'") && value.endsWith("'");
    if (hasDoubleQuotes || hasSingleQuotes) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

function sendText(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

async function readJson(filePath) {
  const raw = await fsp.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, payload) {
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const suffix = `${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}`;
  const tempPath = path.join(dir, `.${base}.${suffix}.tmp`);

  try {
    await fsp.writeFile(tempPath, body, "utf8");
    await fsp.rename(tempPath, filePath);
  } catch (error) {
    try { await fsp.unlink(tempPath); } catch {}
    throw error;
  }
}

function durationLabel(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function timestampLabel(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = String(totalSeconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function queueLabel(queueId) {
  const labels = {
    420: "RANKED_SOLO",
    430: "NORMAL_BLIND",
    440: "RANKED_FLEX",
    450: "ARAM",
  };
  return labels[queueId] || `QUEUE_${queueId}`;
}

function rankedQueueLabel(queueType) {
  const labels = {
    RANKED_SOLO_5x5: "솔로랭크",
    RANKED_FLEX_SR: "자유랭크",
  };
  return labels[queueType] || queueType || "랭크";
}

function buildRankedSnapshot(entry) {
  if (!entry) return null;
  const wins = Number(entry.wins || 0);
  const losses = Number(entry.losses || 0);
  return {
    queueType: entry.queueType || "",
    queueLabel: rankedQueueLabel(entry.queueType),
    tier: entry.tier || "",
    rank: entry.rank || "",
    lp: Number(entry.leaguePoints || 0),
    wins,
    losses,
    winRate: Math.round((wins / Math.max(1, wins + losses)) * 100),
  };
}

function selectRankedEntry(entries) {
  if (!Array.isArray(entries)) return null;
  return (
    entries.find((entry) => entry.queueType === "RANKED_SOLO_5x5") ||
    entries.find((entry) => entry.queueType === "RANKED_FLEX_SR") ||
    null
  );
}

function normalizeRole(role) {
  const map = {
    TOP: "TOP",
    JUNGLE: "JUNGLE",
    MIDDLE: "MID",
    MID: "MID",
    BOTTOM: "ADC",
    ADC: "ADC",
    UTILITY: "SUPPORT",
    SUPPORT: "SUPPORT",
  };
  return map[role] || role || "UNKNOWN";
}

function regionalCluster(platformRegion) {
  const map = {
    KR: "asia",
    JP1: "asia",
    NA1: "americas",
    BR1: "americas",
    LA1: "americas",
    LA2: "americas",
    EUW1: "europe",
    EUN1: "europe",
    TR1: "europe",
    RU: "europe",
  };
  return map[String(platformRegion || "").toUpperCase()] || "asia";
}

function participantTeam(participantId) {
  if (participantId >= 1 && participantId <= 5) {
    return 100;
  }
  if (participantId >= 6 && participantId <= 10) {
    return 200;
  }
  return null;
}

function phaseFor(timestampMs) {
  if (timestampMs <= 900000) {
    return "EARLY";
  }
  if (timestampMs <= 1800000) {
    return "MID";
  }
  return "LATE";
}

function laneHintForEvent(event) {
  if (event.monsterType === "DRAGON") {
    return "DRAGON_RIVER";
  }
  if (event.monsterType === "BARON_NASHOR") {
    return "BARON_RIVER";
  }
  if (event.monsterType === "RIFTHERALD" || event.monsterType === "HORDE") {
    return "TOP_RIVER";
  }
  if (event.laneType === "MID_LANE") {
    return "MID_LANE";
  }
  if (event.laneType === "TOP_LANE") {
    return "TOP_LANE";
  }
  if (event.laneType === "BOT_LANE") {
    return "BOT_LANE";
  }
  return "RIVER";
}

function importanceForEvent(eventType, phase, event) {
  if (eventType === "BARON_FIGHT") {
    return 5;
  }
  if (eventType === "DRAGON_FIGHT") {
    return phase === "EARLY" ? 4 : 5;
  }
  if (eventType === "OBJECTIVE_SETUP_WIN" || eventType === "OBJECTIVE_SETUP_FAIL") {
    return event.monsterType === "RIFTHERALD" || event.monsterType === "HORDE" ? 4 : 5;
  }
  if (eventType === "PLAYER_DEATH") {
    return phase === "EARLY" ? 4 : 5;
  }
  if (eventType === "TOWER_TAKE") {
    if (event.buildingType === "INHIBITOR_BUILDING" || event.towerType === "NEXUS_TURRET") {
      return 5;
    }
    return phase === "EARLY" ? 3 : 4;
  }
  if (eventType === "CHAMPION_KILL") {
    return phase === "LATE" ? 4 : 4;
  }
  return phase === "EARLY" ? 3 : 4;
}

function summaryForEvent(eventType, phase, event, playerWonObjective) {
  if (eventType === "PLAYER_DEATH") {
    if (phase === "EARLY") {
      return "초반 교전에서 먼저 끊기며 템포가 흔들렸다.";
    }
    if (phase === "MID") {
      return "중반 핵심 구도에서 데스를 내주며 운영 안정감이 흔들렸다.";
    }
    return "후반 결정적인 구도에서 생존하지 못했다.";
  }

  if (eventType === "CHAMPION_KILL") {
    return "교전에서 직접 킬을 만들며 흐름을 당겨 왔다.";
  }

  if (eventType === "TEAMFIGHT_FOLLOWUP" || eventType === "SKIRMISH_WIN") {
    return "교전 후속 합류로 킬 관여를 만들었다.";
  }

  if (eventType === "DRAGON_FIGHT") {
    return "드래곤 타이밍에 합류해 오브젝트 템포를 챙겼다.";
  }

  if (eventType === "BARON_FIGHT") {
    return playerWonObjective
      ? "바론 확보에 관여하며 경기 흐름을 다시 붙잡았다."
      : "바론 구도에 관여했지만 상대에게 바론을 내줬다.";
  }

  if (eventType === "OBJECTIVE_SETUP_WIN") {
    return "정글 오브젝트를 챙기며 구조물 압박 재료를 마련했다.";
  }

  if (eventType === "OBJECTIVE_SETUP_FAIL") {
    return "중요 오브젝트나 구조물을 상대에게 내주며 흐름이 흔들렸다.";
  }

  if (eventType === "TOWER_TAKE") {
    return "구조물 압박에 관여하며 승리 조건을 구조물로 전환했다.";
  }

  return "핵심 장면에 관여했다.";
}

function buildEventType(rawEvent, targetParticipantId, targetTeamId, playerWonObjective) {
  if (rawEvent.type === "CHAMPION_KILL") {
    if (rawEvent.victimId === targetParticipantId) {
      return "PLAYER_DEATH";
    }
    if (rawEvent.killerId === targetParticipantId) {
      return "CHAMPION_KILL";
    }
    return rawEvent.assistingParticipantIds.length > 1 ? "TEAMFIGHT_FOLLOWUP" : "SKIRMISH_WIN";
  }

  if (rawEvent.type === "ELITE_MONSTER_KILL") {
    if (rawEvent.monsterType === "DRAGON") {
      return playerWonObjective ? "DRAGON_FIGHT" : "OBJECTIVE_SETUP_FAIL";
    }
    if (rawEvent.monsterType === "BARON_NASHOR") {
      return "BARON_FIGHT";
    }
    return playerWonObjective ? "OBJECTIVE_SETUP_WIN" : "OBJECTIVE_SETUP_FAIL";
  }

  if (rawEvent.type === "BUILDING_KILL") {
    return rawEvent.teamId === targetTeamId ? "OBJECTIVE_SETUP_FAIL" : "TOWER_TAKE";
  }

  return "SKIRMISH_WIN";
}

function shouldKeepEvent(rawEvent, targetParticipantId, targetTeamId) {
  const playerInvolved =
    rawEvent.killerId === targetParticipantId ||
    rawEvent.victimId === targetParticipantId ||
    rawEvent.assistingParticipantIds.includes(targetParticipantId);

  if (rawEvent.type === "CHAMPION_KILL") {
    return playerInvolved;
  }

  if (rawEvent.type === "ELITE_MONSTER_KILL") {
    return true;
  }

  if (rawEvent.type === "BUILDING_KILL") {
    return playerInvolved || rawEvent.teamId !== targetTeamId;
  }

  return false;
}

function dedupeEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = [
      event.timestampMs,
      event.eventType,
      event.rawRef.frameIndex,
      event.rawRef.eventIndex,
    ].join(":");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function extractTimelineEvents(matchDetail, timeline, targetParticipantId, targetTeamId) {
  const events = [];
  let eventIndex = 1;
  let lastHordeTimestamp = -Infinity;

  timeline.info.frames.forEach((frame, frameIndex) => {
    frame.events.forEach((event, innerIndex) => {
      const rawEvent = {
        type: event.type,
        timestamp: event.timestamp || 0,
        killerId: event.killerId || null,
        victimId: event.victimId || null,
        assistingParticipantIds: event.assistingParticipantIds || [],
        monsterType: event.monsterType || null,
        monsterSubType: event.monsterSubType || null,
        buildingType: event.buildingType || null,
        laneType: event.laneType || null,
        towerType: event.towerType || null,
        teamId: event.teamId || null,
      };

      if (
        rawEvent.type !== "CHAMPION_KILL" &&
        rawEvent.type !== "ELITE_MONSTER_KILL" &&
        rawEvent.type !== "BUILDING_KILL"
      ) {
        return;
      }

      if (!shouldKeepEvent(rawEvent, targetParticipantId, targetTeamId)) {
        return;
      }

      if (
        rawEvent.type === "ELITE_MONSTER_KILL" &&
        rawEvent.monsterType === "HORDE" &&
        rawEvent.timestamp - lastHordeTimestamp < 20000
      ) {
        return;
      }

      if (rawEvent.type === "ELITE_MONSTER_KILL" && rawEvent.monsterType === "HORDE") {
        lastHordeTimestamp = rawEvent.timestamp;
      }

      const objectiveTeam = participantTeam(rawEvent.killerId);
      const playerWonObjective = objectiveTeam === targetTeamId;
      const phase = phaseFor(rawEvent.timestamp);
      const eventType = buildEventType(rawEvent, targetParticipantId, targetTeamId, playerWonObjective);

      events.push({
        eventId: `evt_${String(eventIndex).padStart(3, "0")}`,
        timestampMs: rawEvent.timestamp,
        timestampLabel: timestampLabel(rawEvent.timestamp),
        phase,
        eventType,
        importance: importanceForEvent(eventType, phase, rawEvent),
        isPlayerInvolved:
          rawEvent.killerId === targetParticipantId ||
          rawEvent.victimId === targetParticipantId ||
          rawEvent.assistingParticipantIds.includes(targetParticipantId),
        laneHint: laneHintForEvent(rawEvent),
        summary: summaryForEvent(eventType, phase, rawEvent, playerWonObjective),
        rawRef: {
          frameIndex,
          eventIndex: innerIndex,
        },
      });

      eventIndex += 1;
    });
  });

  return dedupeEvents(events);
}

function buildPhaseContext(events) {
  const phases = {
    EARLY: { startMs: 0, endMs: 900000, kills: 0, deaths: 0, assists: 0, notableEventCount: 0 },
    MID: {
      startMs: 900001,
      endMs: 1800000,
      kills: 0,
      deaths: 0,
      assists: 0,
      notableEventCount: 0,
    },
    LATE: {
      startMs: 1800001,
      endMs: events.length ? events[events.length - 1].timestampMs : 1800001,
      kills: 0,
      deaths: 0,
      assists: 0,
      notableEventCount: 0,
    },
  };

  events.forEach((event) => {
    const bucket = phases[event.phase];
    if (!bucket) {
      return;
    }
    if (event.eventType === "CHAMPION_KILL") {
      bucket.kills += 1;
    } else if (event.eventType === "PLAYER_DEATH") {
      bucket.deaths += 1;
    } else if (event.eventType === "TEAMFIGHT_FOLLOWUP" || event.eventType === "SKIRMISH_WIN") {
      bucket.assists += 1;
    }
    if (event.importance >= 4) {
      bucket.notableEventCount += 1;
    }
  });

  return {
    early: phases.EARLY,
    mid: phases.MID,
    late: phases.LATE,
  };
}

// 오브젝트 처치 직후(POST_OBJECTIVE_DEATH_WINDOW_MS 이내) 발생한 데스만 추출.
// 호출부마다 objectiveWins 집합 정의가 다르므로(예: TOWER_TAKE 포함 여부) 인자로 받는다.
function filterPostObjectiveDeaths(deaths, objectiveWins) {
  return deaths.filter((deathEvent) =>
    objectiveWins.some(
      (objectiveEvent) =>
        objectiveEvent.timestampMs < deathEvent.timestampMs &&
        deathEvent.timestampMs - objectiveEvent.timestampMs <= POST_OBJECTIVE_DEATH_WINDOW_MS,
    ),
  );
}

function buildDerivedSignals(normalized) {
  const events = normalized.timelineEvents;
  const objectiveWins = events.filter((event) =>
    ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN", "TOWER_TAKE"].includes(event.eventType),
  );
  const objectiveFails = events.filter((event) => event.eventType === "OBJECTIVE_SETUP_FAIL");
  const playerDeaths = events.filter((event) => event.eventType === "PLAYER_DEATH");
  const earlyDeaths = playerDeaths.filter((event) => event.phase === "EARLY");
  const lateTowers = events.filter(
    (event) => event.phase === "LATE" && event.eventType === "TOWER_TAKE",
  );
  const postObjectiveDeaths = filterPostObjectiveDeaths(playerDeaths, objectiveWins);

  const candidateThemes = [];
  if (earlyDeaths.length >= 2) {
    candidateThemes.push("weak_early_stability");
  }
  if (objectiveWins.length >= 3) {
    candidateThemes.push("strong_objective_tempo");
  }
  if (postObjectiveDeaths.length >= 1) {
    candidateThemes.push("poor_post_objective_survivability");
  }
  if (
    normalized.matchInfo.position !== "SUPPORT" &&
    normalized.playerStats.csPerMinute <
      CS_LOW_FARM_THRESHOLDS[normalized.matchInfo.position]
  ) {
    candidateThemes.push("low_resource_conversion");
  }
  if (lateTowers.length >= 1 && normalized.matchInfo.result === "WIN") {
    candidateThemes.push("late_structure_closeout");
  }

  return {
    hasEarlyLeadMoments: objectiveWins.some((event) => event.phase === "EARLY"),
    hasMidGameThrowRisk:
      postObjectiveDeaths.length >= 1 ||
      playerDeaths.filter((event) => event.phase === "MID").length >= 2,
    hasObjectiveControlIssues: objectiveFails.length >= 2,
    hasStrongRoamingPattern: false,
    hasPositioningRisk: playerDeaths.length >= 4,
    candidateThemes,
  };
}

function buildNormalized(account, matchDetail, timeline, options) {
  const participant = matchDetail.info.participants.find((entry) => entry.puuid === account.puuid);
  if (!participant) {
    throw new Error("Target participant not found in match.");
  }

  const role = normalizeRole(participant.teamPosition || participant.individualPosition);
  const cs = (participant.totalMinionsKilled || 0) + (participant.neutralMinionsKilled || 0);
  const teamTotalKills = matchDetail.info.participants
    .filter((entry) => entry.teamId === participant.teamId)
    .reduce((sum, entry) => sum + (entry.kills || 0), 0);

  const timelineEvents = extractTimelineEvents(matchDetail, timeline, participant.participantId, participant.teamId);
  const phaseContext = buildPhaseContext(timelineEvents);

  const normalized = {
    schemaVersion: "1.0",
    sourceMeta: {
      sourceType: "riot_match_v5",
      fetchedAt: new Date().toISOString(),
      platformRegion: String(options.platformRegion || "KR").toUpperCase(),
      regionalCluster: String(options.cluster || "asia").toUpperCase(),
      rawMatchId: matchDetail.metadata.matchId,
    },
    playerContext: {
      puuid: account.puuid,
      riotId: options.publicAlias,
      isAnonymous: true,
      participantId: participant.participantId,
    },
    matchInfo: {
      matchId: matchDetail.metadata.matchId,
      queueId: matchDetail.info.queueId,
      queueLabel: queueLabel(matchDetail.info.queueId),
      mapId: matchDetail.info.mapId,
      mapLabel: matchDetail.info.mapId === 11 ? "SUMMONERS_RIFT" : `MAP_${matchDetail.info.mapId}`,
      gameVersion: matchDetail.info.gameVersion,
      gameCreation: new Date(matchDetail.info.gameCreation).toISOString(),
      durationSeconds: matchDetail.info.gameDuration,
      durationLabel: durationLabel(matchDetail.info.gameDuration),
      result: participant.win ? "WIN" : "LOSS",
      champion: participant.championName,
      position: role,
      teamId: participant.teamId,
    },
    playerStats: {
      kills: participant.kills || 0,
      deaths: participant.deaths || 0,
      assists: participant.assists || 0,
      kda: Number(((participant.kills + participant.assists) / Math.max(1, participant.deaths)).toFixed(2)),
      cs,
      csPerMinute: Number((cs / (matchDetail.info.gameDuration / 60)).toFixed(2)),
      goldEarned: participant.goldEarned || 0,
      damageToChampions: participant.totalDamageDealtToChampions || 0,
      visionScore: participant.visionScore || 0,
      killParticipation: Number(
        (((participant.kills + participant.assists) / Math.max(1, teamTotalKills))).toFixed(2),
      ),
      champLevel: participant.champLevel || 0,
      summonerSpells: [participant.summoner1Id || 0, participant.summoner2Id || 0],
      items: [
        participant.item0 || 0,
        participant.item1 || 0,
        participant.item2 || 0,
        participant.item3 || 0,
        participant.item4 || 0,
        participant.item5 || 0,
        participant.item6 || 0,
      ],
    },
    challengeStats: (() => {
      const c = participant.challenges || {};
      return {
        damagePerMinute: c.damagePerMinute || 0,
        goldPerMinute: c.goldPerMinute || 0,
        visionScorePerMinute: c.visionScorePerMinute || 0,
        killParticipation: c.killParticipation || 0,
        teamDamagePercentage: c.teamDamagePercentage || 0,
        soloKills: c.soloKills || 0,
        laneMinionsFirst10Minutes: c.laneMinionsFirst10Minutes || 0,
        maxCsAdvantageOnLaneOpponent: c.maxCsAdvantageOnLaneOpponent || 0,
        maxLevelLeadLaneOpponent: c.maxLevelLeadLaneOpponent || 0,
        turretPlatesTaken: c.turretPlatesTaken || 0,
        earlyLaningPhaseGoldExpAdvantage: c.earlyLaningPhaseGoldExpAdvantage || 0,
        controlWardsPlaced: c.controlWardsPlaced || 0,
        skillshotsDodged: c.skillshotsDodged || 0,
        outnumberedKills: c.outnumberedKills || 0,
      };
    })(),
    teamContext: {
      teamTotalKills,
      teamGoldEstimate: 0,
      teamDragons:
        matchDetail.info.teams.find((team) => team.teamId === participant.teamId)?.objectives?.dragon
          ?.kills || 0,
      teamBarons:
        matchDetail.info.teams.find((team) => team.teamId === participant.teamId)?.objectives?.baron
          ?.kills || 0,
      teamTowers:
        matchDetail.info.teams.find((team) => team.teamId === participant.teamId)?.objectives?.tower
          ?.kills || 0,
      enemyDragons:
        matchDetail.info.teams.find((team) => team.teamId !== participant.teamId)?.objectives?.dragon
          ?.kills || 0,
      enemyBarons:
        matchDetail.info.teams.find((team) => team.teamId !== participant.teamId)?.objectives?.baron
          ?.kills || 0,
      enemyTowers:
        matchDetail.info.teams.find((team) => team.teamId !== participant.teamId)?.objectives?.tower
          ?.kills || 0,
    },
    phaseContext,
    timelineEvents,
    derivedSignals: {
      hasEarlyLeadMoments: false,
      hasMidGameThrowRisk: false,
      hasObjectiveControlIssues: false,
      hasStrongRoamingPattern: false,
      hasPositioningRisk: false,
      candidateThemes: [],
    },
  };

  normalized.derivedSignals = buildDerivedSignals(normalized);
  normalized.playtimeScore = buildPlaytimeScore(normalized);

  // participantId → teamId 매핑 (오브젝트 타임라인용)
  const participantTeamMap = new Map();
  matchDetail.info.participants.forEach((p) => participantTeamMap.set(p.participantId, p.teamId));
  normalized.objectiveTimeline = buildObjectiveTimeline(timeline, participant.teamId, participantTeamMap);
  normalized.kdaTimeline = buildKdaTimeline(normalized);
  normalized.wardTimeline = buildWardTimeline(timeline, participant.participantId);
  normalized.itemTimeline = buildItemTimeline(timeline, participant.participantId);

  return normalized;
}

function bestObjectiveSummary(normalized) {
  const wins = normalized.timelineEvents.filter((event) =>
    ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"].includes(event.eventType),
  );
  if (wins.length >= 4) {
    return "주요 오브젝트 타이밍을 꾸준히 챙겼음";
  }
  if (wins.length >= 2) {
    return "오브젝트 타이밍에 자주 합류했음";
  }
  return null;
}

function bestFightSummary(normalized) {
  const combat = normalized.timelineEvents.filter((event) =>
    ["CHAMPION_KILL", "TEAMFIGHT_FOLLOWUP", "SKIRMISH_WIN"].includes(event.eventType),
  );
  if (combat.length >= 3 || normalized.playerStats.killParticipation >= 0.35) {
    return "교전 후속 합류 기여가 좋았음";
  }
  return null;
}

function lowFarmThreshold(position) {
  return CS_LOW_FARM_THRESHOLDS[position] || 0;
}

function buildStrengths(normalized) {
  const strengths = [];
  const events = normalized.timelineEvents;
  const objectiveTitle = bestObjectiveSummary(normalized);
  const fightTitle = bestFightSummary(normalized);

  if (objectiveTitle) {
    const linked = events
      .filter((event) => ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"].includes(event.eventType))
      .slice(0, 4);
    strengths.push({
      id: "str_01",
      title: objectiveTitle,
      description:
        "초중후반 오브젝트 타이밍에 빠지지 않고 관여해 팀이 경기 구조를 잃지 않도록 만들었다.",
      evidence: linked
        .map((event) => `${event.timestampLabel} ${event.eventType}`)
        .join(", "),
      impact:
        normalized.matchInfo.result === "WIN"
          ? "팀이 유리한 운영 구조를 유지하는 데 큰 도움이 됐다."
          : "불리한 경기에서도 역전 기회를 여러 번 만들 수 있었다.",
      relatedEventIds: linked.map((event) => event.eventId),
    });
  }

  if (fightTitle) {
    const linked = events
      .filter((event) => ["CHAMPION_KILL", "TEAMFIGHT_FOLLOWUP", "SKIRMISH_WIN"].includes(event.eventType))
      .slice(0, 3);
    strengths.push({
      id: "str_02",
      title: fightTitle,
      description:
        "개인 킬 수보다도 팀 교전이 열렸을 때 늦지 않게 붙어 한타 흐름을 이어 주는 장면이 많았다.",
      evidence: linked
        .map((event) => `${event.timestampLabel} ${event.summary}`)
        .join(" "),
      impact: "한타가 길어졌을 때 팀이 추가 킬을 만드는 흐름을 도와줬다.",
      relatedEventIds: linked.map((event) => event.eventId),
    });
  }

  if (normalized.playerStats.visionScore >= (normalized.matchInfo.position === "JUNGLE" ? 35 : 25)) {
    strengths.push({
      id: "str_03",
      title: "시야 투자량이 높은 편이었음",
      description:
        "해당 포지션 기준으로 시야 점수가 높은 편이라, 단순히 싸움만 한 경기는 아니었다.",
      evidence: `비전 점수 ${normalized.playerStats.visionScore} 기록`,
      impact: "오브젝트 준비와 팀 합류 타이밍을 맞추는 기반이 됐다.",
      relatedEventIds: ["stat_vision"],
    });
  }

  if (
    strengths.length < INSIGHT_LIST_MIN &&
    normalized.matchInfo.result === "WIN" &&
    events.some((event) => event.eventType === "TOWER_TAKE")
  ) {
    const linked = events.filter((event) => event.eventType === "TOWER_TAKE").slice(-2);
    strengths.push({
      id: `str_0${strengths.length + 1}`,
      title: "구조물 압박으로 승리 조건을 연결했음",
      description: "교전에서 끝나지 않고 구조물 파괴로 승리 조건을 실제 결과로 전환했다.",
      evidence: linked.map((event) => `${event.timestampLabel} ${event.laneHint}`).join(", "),
      impact: "길어질 수 있는 경기를 실제 승리로 마무리했다.",
      relatedEventIds: linked.map((event) => event.eventId),
    });
  }

  while (strengths.length < INSIGHT_LIST_MIN) {
    strengths.push({
      id: `str_0${strengths.length + 1}`,
      title: "주요 구도에 계속 합류했음",
      description: "라인이나 정글을 비우는 타이밍에도 핵심 구도에 늦지 않게 관여한 장면이 있었다.",
      evidence: "중요 이벤트 구간에 반복적으로 등장했다.",
      impact: "팀이 완전히 무너지지 않도록 시간을 벌었다.",
      relatedEventIds: events.slice(0, 2).map((event) => event.eventId),
    });
  }

  return strengths.slice(0, INSIGHT_LIST_MAX);
}

function buildWeaknesses(normalized) {
  const weaknesses = [];
  const events = normalized.timelineEvents;
  const deaths = events.filter((event) => event.eventType === "PLAYER_DEATH");
  const earlyDeaths = deaths.filter((event) => event.phase === "EARLY");
  const objectiveWins = events.filter((event) =>
    ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"].includes(event.eventType),
  );
  const postObjectiveDeaths = filterPostObjectiveDeaths(deaths, objectiveWins);

  if (earlyDeaths.length >= 2) {
    weaknesses.push({
      id: "weak_01",
      title: "초반 안정감이 낮았음",
      description: "초반 데스로 성장 구간을 어렵게 시작하면서 이후 운영이 더 까다로워졌다.",
      evidence: earlyDeaths.map((event) => `${event.timestampLabel} ${event.summary}`).join(" "),
      impact: "초반 스노우볼을 만들거나 안정적인 성장 곡선을 그리기 어려웠다.",
      improvementHint:
        "초반 10분은 오브젝트 이후나 라인 푸시 이후에 한 템포 먼저 빠지는 기준을 만들어 손해 없는 출발을 우선하는 것이 좋다.",
      relatedEventIds: earlyDeaths.map((event) => event.eventId),
    });
  }

  if (normalized.playerStats.csPerMinute < lowFarmThreshold(normalized.matchInfo.position)) {
    weaknesses.push({
      id: `weak_0${weaknesses.length + 1}`,
      title: "자원 전환 속도가 느렸음",
      description: "포지션 기준으로 분당 CS가 낮아 골드 전환 속도가 더 느린 편이었다.",
      evidence: `총 CS ${normalized.playerStats.cs}, 분당 CS ${normalized.playerStats.csPerMinute}`,
      impact: "오브젝트 관여를 해도 개인 성장 속도가 늦어 후반 영향력이 줄어들 수 있다.",
      improvementHint:
        "교전이 비는 구간에는 가장 가까운 웨이브나 캠프를 더 확실하게 챙겨 자원 손실을 줄이는 연습이 필요하다.",
      relatedEventIds: ["stat_cs"],
    });
  }

  if (postObjectiveDeaths.length >= 1 || normalized.playerStats.deaths >= (normalized.matchInfo.result === "WIN" ? 5 : 4)) {
    const linked = postObjectiveDeaths.length ? postObjectiveDeaths : deaths.slice(0, 2);
    weaknesses.push({
      id: `weak_0${weaknesses.length + 1}`,
      title: "오브젝트 이후 생존과 전환이 아쉬웠음",
      description:
        "큰 오브젝트를 챙긴 뒤나 한타 직후에 데스를 내주며 만든 이득을 더 길게 굴리지 못한 장면이 있었다.",
      evidence: linked.map((event) => `${event.timestampLabel} ${event.summary}`).join(" "),
      impact:
        normalized.matchInfo.result === "WIN"
          ? "이기는 경기를 더 길게 끌고 가는 원인이 됐다."
          : "오브젝트로 만든 반격 흐름이 다시 끊겼다.",
      improvementHint:
        "오브젝트를 챙긴 뒤에는 추가 교전을 오래 보기보다 먼저 리셋, 시야 재정비, 라인 정리를 우선하는 루틴이 필요하다.",
      relatedEventIds: linked.map((event) => event.eventId),
    });
  }

  while (weaknesses.length < INSIGHT_LIST_MIN) {
    const objectiveFails = events.filter((event) => event.eventType === "OBJECTIVE_SETUP_FAIL");
    const linked = objectiveFails.length ? objectiveFails.slice(0, 2) : deaths.slice(0, 2);
    weaknesses.push({
      id: `weak_0${weaknesses.length + 1}`,
      title: "중요 구도 판단을 더 빠르게 정리할 필요가 있음",
      description: "contest와 이탈 중 하나를 더 빠르게 정하면 손실을 줄일 수 있는 장면이 있었다.",
      evidence:
        linked.length > 0
          ? linked.map((event) => `${event.timestampLabel} ${event.summary}`).join(" ")
          : "중요 구도에서 판단이 길어진 장면이 있었다.",
      impact: "작은 지연이 데스나 오브젝트 손실로 이어질 수 있다.",
      improvementHint: "시야가 밀리거나 숫자가 안 맞으면 contest 기준을 짧게 정하고 빠르게 후퇴하는 콜을 만드는 편이 좋다.",
      relatedEventIds: linked.map((event) => event.eventId),
    });
  }

  return weaknesses.slice(0, INSIGHT_LIST_MAX);
}

function buildActionChecklist(normalized, weaknesses) {
  const checklistWeaknesses = Array.isArray(weaknesses) ? weaknesses.slice(0, ACTION_CHECKLIST_MAX) : [];
  while (checklistWeaknesses.length < ACTION_CHECKLIST_MIN) {
    checklistWeaknesses.push({ improvementHint: "체크리스트 최소 항목을 채우기 위한 기본 개선 루틴" });
  }
  return checklistWeaknesses.map((item, index) => ({
    id: `act_0${index + 1}`,
    priority: index + 1,
    action:
      index === 0
        ? "초반 주요 구도 직후에는 한 템포 먼저 빠지는 기준 만들기"
        : index === 1
          ? "교전이 비는 구간에는 웨이브나 캠프를 더 확실하게 챙겨 자원 손실 줄이기"
          : index === 2
            ? "드래곤·바론 직후에는 추가 추격보다 리셋과 라인 정리를 먼저 선택하기"
            : "시야가 밀릴 때는 contest와 이탈 중 하나를 더 빠르게 결정하기",
    reason: item.improvementHint,
  }));
}

function buildPhaseSummaries(normalized) {
  const eventsByPhase = {
    EARLY: normalized.timelineEvents.filter((event) => event.phase === "EARLY"),
    MID: normalized.timelineEvents.filter((event) => event.phase === "MID"),
    LATE: normalized.timelineEvents.filter((event) => event.phase === "LATE"),
  };

  return ["EARLY", "MID", "LATE"].map((phaseKey) => {
    const phaseEvents = eventsByPhase[phaseKey];
    const bucket =
      phaseKey === "EARLY"
        ? normalized.phaseContext.early
        : phaseKey === "MID"
          ? normalized.phaseContext.mid
          : normalized.phaseContext.late;

    const objectiveWins = phaseEvents.filter((event) =>
      ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN", "TOWER_TAKE"].includes(event.eventType),
    ).length;
    const objectiveFails = phaseEvents.filter((event) => event.eventType === "OBJECTIVE_SETUP_FAIL").length;
    const rating =
      bucket.deaths > bucket.kills + bucket.assists
        ? "BAD"
        : objectiveWins > objectiveFails
          ? "GOOD"
          : "NEUTRAL";

    const summary =
      phaseKey === "EARLY"
        ? bucket.deaths >= 2
          ? "초반에는 먼저 끊기며 안정감이 떨어졌지만, 오브젝트 타이밍 합류는 계속 시도했다."
          : "초반 오브젝트와 첫 교전 템포를 무난하게 챙겼다."
        : phaseKey === "MID"
          ? objectiveWins >= 2
            ? "중반에는 오브젝트나 한타 후속 합류가 살아 있어 경기 핵심 구도를 주도했다."
            : "중반에는 좋은 장면과 아쉬운 장면이 함께 나오며 흐름이 요동쳤다."
          : normalized.matchInfo.result === "WIN"
            ? "후반에는 구조물 마무리와 중요한 교전 정리가 승리로 연결됐다."
            : "후반에는 교전 영향력은 있었지만 마지막 수비 구도를 지키지 못했다.";

    const focus =
      phaseKey === "EARLY"
        ? "초반엔 오브젝트 직후 체력과 라인 상태를 먼저 정리해 손해 없는 출발을 만드는 것이 중요하다."
        : phaseKey === "MID"
          ? "중반엔 오브젝트를 챙긴 뒤 바로 다음 라인과 시야 정리까지 연결하는 루틴을 고정하면 좋다."
          : "후반에는 킬 자체보다 살아남아 구조물을 어떻게 밀지 빠르게 정리하는 판단이 중요하다.";

    return {
      phase: phaseKey,
      rating,
      summary,
      focus,
    };
  });
}

// ─── Playtime Score ──────────────────────────────────────────────────────

function clamp10(v) { return Math.min(10, Math.max(0, +v.toFixed(1))); }

function calcCombatScore(stats, challenges, minutes) {
  const dpm = challenges.damagePerMinute || (stats.damageToChampions / minutes);
  const kdaPart = Math.min(stats.kda, 6) / 6 * 5;
  const kpPart = Math.min(challenges.killParticipation || stats.killParticipation, 0.6) / 0.6 * 2;
  const dpmPart = Math.min(dpm / 800, 1) * 2;
  const soloPart = Math.min((challenges.soloKills || 0), 3) * 0.33;
  return clamp10(kdaPart + kpPart + dpmPart + soloPart);
}

function calcIncomeScore(stats, challenges, position, minutes) {
  const csThreshold = CS_FULL_SCORE_TARGETS[position] || 6;
  const gpm = challenges.goldPerMinute || (stats.goldEarned / minutes);
  const csPart = Math.min(stats.csPerMinute / csThreshold, 1.2) * 4;
  const goldPart = Math.min(gpm / 450, 1.2) * 4;
  const platePart = Math.min((challenges.turretPlatesTaken || 0), 5) * 0.4;
  return clamp10(csPart + goldPart + platePart);
}

function calcVisionScore(stats, challenges, minutes) {
  const vsPerMin = challenges.visionScorePerMinute || (stats.visionScore / minutes);
  const cwPart = Math.min((challenges.controlWardsPlaced || 0), 8) * 0.25;
  return clamp10(Math.min(vsPerMin / 1.5, 1.2) * 8 + cwPart);
}

function calcSurvivalScore(stats, minutes) {
  const deathsPerMin = stats.deaths / minutes;
  if (deathsPerMin <= 0.1) return 10;
  if (deathsPerMin <= 0.2) return 8;
  if (deathsPerMin <= 0.3) return 6;
  if (deathsPerMin <= 0.4) return 4;
  return clamp10(2 - (deathsPerMin - 0.4) * 5);
}

function calcObjectiveScore(events) {
  const wins = events.filter((e) => ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"].includes(e.eventType)).length;
  const fails = events.filter((e) => e.eventType === "OBJECTIVE_SETUP_FAIL").length;
  const total = wins + fails;
  if (total === 0) return 5;
  const ratio = wins / total;
  return clamp10(ratio * 8 + Math.min(wins, 5) * 0.4);
}

function calcStructureScore(team, events) {
  const towerTakes = events.filter((e) => e.eventType === "TOWER_TAKE").length;
  const towerDiff = (team.teamTowers || 0) - (team.enemyTowers || 0);
  const towerPart = Math.min(towerTakes, 4) * 1.5;
  const diffPart = Math.min(Math.max(towerDiff + 3, 0), 6) / 6 * 4;
  return clamp10(towerPart + diffPart);
}

function buildPlaytimeScore(normalized) {
  const stats = normalized.playerStats;
  const challenges = normalized.challengeStats || {};
  const info = normalized.matchInfo;
  const team = normalized.teamContext;
  const events = normalized.timelineEvents;
  // durationSeconds가 0/60 미만인 비정상 매치에서도 점수 분모가 0/NaN이 되지 않도록 하한 1분.
  const minutes = Math.max(1, info.durationSeconds / 60);

  const combat = calcCombatScore(stats, challenges, minutes);
  const income = calcIncomeScore(stats, challenges, info.position, minutes);
  const vision = calcVisionScore(stats, challenges, minutes);
  const survival = calcSurvivalScore(stats, minutes);
  const objective = calcObjectiveScore(events);
  const structure = calcStructureScore(team, events);

  const overall = +(combat * 0.25 + income * 0.20 + vision * 0.10 + survival * 0.20 + objective * 0.15 + structure * 0.10).toFixed(1);

  return {
    overall,
    categories: { combat, income, vision, survival, objective, structure },
    label: overall >= 8 ? "MVP급" : overall >= 6 ? "양호" : overall >= 4 ? "보통" : "개선 필요",
  };
}

// ─── Objective Timeline ──────────────────────────────────────────────────

function buildStructureLabel(event) {
  const tower = { OUTER_TURRET: "외곽 타워", INNER_TURRET: "내부 타워", BASE_TURRET: "억제기 타워", NEXUS_TURRET: "넥서스 타워" };
  const lane = { TOP_LANE: "탑", MID_LANE: "미드", BOT_LANE: "봇" };
  if (event.buildingType === "INHIBITOR_BUILDING") return `${lane[event.laneType] || ""} 억제기`;
  return `${lane[event.laneType] || ""} ${tower[event.towerType] || "구조물"}`;
}

function buildObjectiveLabel(event) {
  const labels = { DRAGON: "드래곤", BARON_NASHOR: "바론", RIFTHERALD: "전령", HORDE: "공허 유충" };
  const sub = event.monsterSubType ? ` (${event.monsterSubType.replace(/_/g, " ").toLowerCase()})` : "";
  return `${labels[event.monsterType] || event.monsterType}${sub}`;
}

function buildObjectiveTimeline(timeline, targetTeamId, participantTeamMap) {
  const events = [];
  timeline.info.frames.forEach((frame) => {
    frame.events.forEach((event) => {
      if (event.type === "BUILDING_KILL") {
        events.push({
          time: event.timestamp,
          timeLabel: timestampLabel(event.timestamp),
          phase: phaseFor(event.timestamp),
          type: "STRUCTURE",
          subtype: event.towerType || event.buildingType,
          lane: event.laneType || "",
          team: event.teamId === targetTeamId ? "ENEMY" : "ALLY",
          label: buildStructureLabel(event),
        });
      }
      if (event.type === "ELITE_MONSTER_KILL") {
        const killerTeam = participantTeamMap.get(event.killerId);
        events.push({
          time: event.timestamp,
          timeLabel: timestampLabel(event.timestamp),
          phase: phaseFor(event.timestamp),
          type: "OBJECTIVE",
          subtype: event.monsterType,
          lane: "",
          team: killerTeam === targetTeamId ? "ALLY" : "ENEMY",
          label: buildObjectiveLabel(event),
        });
      }
    });
  });
  return events.sort((a, b) => a.time - b.time);
}

// ─── Ward Timeline ────────────────────────────────────────────────────────

function buildWardTimeline(timeline, targetParticipantId) {
  const events = [];
  timeline.info.frames.forEach((frame) => {
    frame.events.forEach((event) => {
      if (event.type === "WARD_PLACED" && event.creatorId === targetParticipantId) {
        events.push({
          time: event.timestamp,
          timeLabel: timestampLabel(event.timestamp),
          phase: phaseFor(event.timestamp),
          action: "PLACED",
          wardType: event.wardType || "UNKNOWN",
        });
      }
      if (event.type === "WARD_KILL" && event.killerId === targetParticipantId) {
        events.push({
          time: event.timestamp,
          timeLabel: timestampLabel(event.timestamp),
          phase: phaseFor(event.timestamp),
          action: "KILLED",
          wardType: event.wardType || "UNKNOWN",
        });
      }
    });
  });

  const placed = events.filter((e) => e.action === "PLACED");
  const killed = events.filter((e) => e.action === "KILLED");
  const controlWards = placed.filter((e) => e.wardType === "CONTROL_WARD").length;
  const minutes = (timeline.info.frames.length - 1) || 1;

  return {
    events: events.sort((a, b) => a.time - b.time),
    summary: {
      totalPlaced: placed.length,
      totalKilled: killed.length,
      controlWardsPlaced: controlWards,
      wardsPerMinute: +(placed.length / minutes).toFixed(2),
      byPhase: {
        EARLY: placed.filter((e) => e.phase === "EARLY").length,
        MID: placed.filter((e) => e.phase === "MID").length,
        LATE: placed.filter((e) => e.phase === "LATE").length,
      },
    },
  };
}

// ─── Item Build Timeline ──────────────────────────────────────────────────

function buildItemTimeline(timeline, targetParticipantId) {
  const events = [];
  timeline.info.frames.forEach((frame) => {
    frame.events.forEach((event) => {
      if (event.type === "ITEM_PURCHASED" && event.participantId === targetParticipantId) {
        events.push({
          time: event.timestamp,
          timeLabel: timestampLabel(event.timestamp),
          phase: phaseFor(event.timestamp),
          itemId: event.itemId,
        });
      }
    });
  });
  return events.sort((a, b) => a.time - b.time);
}

// ─── KDA Timeline ─────────────────────────────────────────────────────────

function buildKdaTimeline(normalized) {
  const events = normalized.timelineEvents || [];
  let kills = 0;
  let deaths = 0;
  let assists = 0;

  const points = [{ time: 0, timeLabel: "0:00", phase: "EARLY", kills, deaths, assists, kda: 0, event: "게임 시작" }];

  for (const evt of events) {
    if (!evt.isPlayerInvolved) continue;

    let changed = false;
    if (evt.eventType === "PLAYER_DEATH") {
      deaths++;
      changed = true;
    } else if (evt.eventType === "CHAMPION_KILL") {
      kills++;
      changed = true;
    } else if (evt.eventType === "TEAMFIGHT_FOLLOWUP" || evt.eventType === "SKIRMISH_WIN") {
      assists++;
      changed = true;
    }

    if (changed) {
      const kda = +((kills + assists) / Math.max(1, deaths)).toFixed(2);
      points.push({
        time: evt.timestampMs,
        timeLabel: evt.timestampLabel,
        phase: evt.phase,
        kills,
        deaths,
        assists,
        kda,
        event: evt.summary || evt.eventType,
        eventType: evt.eventType,
      });
    }
  }

  return points;
}

function labelForMoment(event) {
  const map = {
    PLAYER_DEATH: "중요 데스",
    CHAMPION_KILL: "직접 킬 확보",
    TEAMFIGHT_FOLLOWUP: "후속 합류 성공",
    SKIRMISH_WIN: "소규모 교전 우세",
    DRAGON_FIGHT: "드래곤 타이밍",
    BARON_FIGHT: "바론 구도",
    OBJECTIVE_SETUP_WIN: "정글 오브젝트 확보",
    OBJECTIVE_SETUP_FAIL: "오브젝트 손실",
    TOWER_TAKE: "구조물 압박",
  };
  return map[event.eventType] || "핵심 장면";
}

function impactForMoment(event, result) {
  if (event.eventType === "PLAYER_DEATH") {
    return result === "WIN" ? "이기는 흐름을 다소 늦췄다." : "팀 운영이 크게 흔들렸다.";
  }
  if (event.eventType === "DRAGON_FIGHT" || event.eventType === "BARON_FIGHT") {
    return "오브젝트 주도권에 직접 영향을 줬다.";
  }
  if (event.eventType === "TOWER_TAKE") {
    return "승리 조건을 구조물로 전환했다.";
  }
  return "교전 흐름을 유리하게 만드는 장면이었다.";
}

function buildKeyMoments(normalized) {
  return normalized.timelineEvents
    .slice()
    .sort((a, b) => {
      if (b.importance !== a.importance) {
        return b.importance - a.importance;
      }
      return a.timestampMs - b.timestampMs;
    })
    .slice(0, 7)
    .sort((a, b) => a.timestampMs - b.timestampMs)
    .map((event) => ({
      eventId: event.eventId,
      timestamp: event.timestampLabel,
      phase: event.phase,
      label: labelForMoment(event),
      reason: event.summary,
      impact: impactForMoment(event, normalized.matchInfo.result),
      importance: event.importance,
      relatedEventIds: [event.eventId],
    }));
}

function buildEvidenceIndex(normalized) {
  const evidence = normalized.timelineEvents
    .filter((event) => event.importance >= 4)
    .slice(0, 10)
    .map((event) => ({
      eventId: event.eventId,
      timestamp: event.timestampLabel,
      eventType: event.eventType,
      summary: event.summary,
      statNote: `${event.phase} · 중요도 ${event.importance}`,
    }));

  evidence.push({
    eventId: "stat_cs",
    timestamp: "FULL",
    eventType: "STAT_SUMMARY",
    summary: `${normalized.matchInfo.position} 포지션 기준 총 CS ${normalized.playerStats.cs}, 분당 ${normalized.playerStats.csPerMinute}`,
    statNote: "자원 전환 속도 참고",
  });

  evidence.push({
    eventId: "stat_vision",
    timestamp: "FULL",
    eventType: "STAT_SUMMARY",
    summary: `비전 점수 ${normalized.playerStats.visionScore}, 킬 관여율 ${Math.round(
      normalized.playerStats.killParticipation * 100,
    )}%`,
    statNote: "시야와 한타 기여 참고",
  });

  return evidence;
}

function buildCoachSummary(normalized) {
  const isWin = normalized.matchInfo.result === "WIN";
  const objectiveEvents = normalized.timelineEvents.filter((event) =>
    ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"].includes(event.eventType),
  );
  const deaths = normalized.timelineEvents.filter((event) => event.eventType === "PLAYER_DEATH");
  const postObjectiveDeaths = filterPostObjectiveDeaths(deaths, objectiveEvents);

  const overallSummary = isWin
    ? "초반 흔들린 장면이 있었지만, 오브젝트 템포와 후속 한타 기여를 계속 만들어 결국 승리 구조를 유지한 경기였다."
    : "초반 손해와 반복된 데스로 성장 템포는 느렸지만, 오브젝트 타이밍에 계속 합류하며 끝까지 역전 기회를 만들었던 경기였다.";

  const gameFlowSummary =
    objectiveEvents.length >= 3
      ? "드래곤과 바론, 혹은 정글 오브젝트 관여가 꾸준히 나왔고, 경기의 핵심 흐름은 오브젝트 이후 전환을 얼마나 안정적으로 했는지에서 갈렸다."
      : "교전과 구조물 구도가 반복되며 경기 흐름이 요동쳤고, 중요한 순간의 데스와 후속 합류가 승패에 큰 영향을 줬다.";

  const winLossReason =
    postObjectiveDeaths.length >= 1
      ? "큰 오브젝트를 챙긴 뒤의 생존과 전환이 승패 차이를 만들었다."
      : isWin
        ? "오브젝트 템포와 구조물 압박 연결이 승리의 핵심이었다."
        : "초반 안정감과 중후반 운영 연결이 아쉬웠다.";

  return {
    overallSummary,
    gameFlowSummary,
    winLossReason,
  };
}

function buildHeadline(normalized, strengths, weaknesses) {
  const isWin = normalized.matchInfo.result === "WIN";
  if (isWin) {
    return "오브젝트 템포는 좋았지만 중간 데스가 섞인 거친 승리 경기";
  }
  if (weaknesses[0]?.title && strengths[0]?.title) {
    return `${strengths[0].title.replace("했음", "")} 좋았지만, ${weaknesses[0].title.replace("했음", "")} 경기`;
  }
  return "핵심 오브젝트 합류와 생존 관리가 승패를 가른 경기";
}

// ─── Rule-based fallback ────────────────────────────────────────────────────

function buildRuleBasedAnalysis(normalized, sampleId) {
  const strengths = buildStrengths(normalized);
  const weaknesses = buildWeaknesses(normalized);
  const coachSummary = buildCoachSummary(normalized);
  const keyMoments = buildKeyMoments(normalized);
  const evidenceIndex = buildEvidenceIndex(normalized);

  return {
    schemaVersion: "1.0",
    analysisMeta: {
      analysisId: `analysis_${sampleId}_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      sourceType: "match_timeline",
      language: "ko",
      confidence: 0.78,
    },
    matchSummary: {
      matchId: normalized.matchInfo.matchId,
      queueType: normalized.matchInfo.queueLabel,
      gameVersion: normalized.matchInfo.gameVersion,
      durationSeconds: normalized.matchInfo.durationSeconds,
      result: normalized.matchInfo.result,
      champion: normalized.matchInfo.champion,
      role: normalized.matchInfo.position,
      headline: buildHeadline(normalized, strengths, weaknesses),
    },
    coachSummary,
    phaseSummaries: buildPhaseSummaries(normalized),
    strengths,
    weaknesses,
    actionChecklist: buildActionChecklist(normalized, weaknesses),
    keyMoments,
    combatAnalysis: [],
    teamfightPhaseAnalysis: mergeTeamfightCoaching(
      buildTeamfightPhases(detectCombatEncounters(normalized.timelineEvents), normalized.timelineEvents),
      [],
    ),
    evidenceIndex,
  };
}

// ─── LLM payload builder ─────────────────────────────────────────────────────

// Phase 32: 전투 KDA 상황 집중 분석용 사전 계산.
// CHAMPION_KILL / PLAYER_DEATH 이벤트를 25초 윈도우로 인접 그룹화 →
// 한타·교전 단위 "encounter"로 만들어 AI에게 컨텍스트로 전달.
// 플레이어 관여(isPlayerInvolved=true) 이벤트가 1개 이상인 그룹만 채택.
function detectCombatEncounters(timelineEvents) {
  const COMBAT_TYPES = new Set(["CHAMPION_KILL", "PLAYER_DEATH"]);
  const WINDOW_MS = 25000;
  const MAX_ENCOUNTERS = 8;

  const combatEvts = timelineEvents
    .filter((e) => COMBAT_TYPES.has(e.eventType))
    .sort((a, b) => (a.timestampMs ?? 0) - (b.timestampMs ?? 0));

  const groups = [];
  let current = null;
  for (const evt of combatEvts) {
    const ts = evt.timestampMs ?? 0;
    if (!current || ts - current.lastMs > WINDOW_MS) {
      current = { events: [evt], firstMs: ts, lastMs: ts };
      groups.push(current);
    } else {
      current.events.push(evt);
      current.lastMs = ts;
    }
  }

  const encounters = [];
  for (const g of groups) {
    const hasPlayer = g.events.some((e) => e.isPlayerInvolved);
    if (!hasPlayer) continue;
    const first = g.events[0];
    const last = g.events[g.events.length - 1];
    let playerKills = 0;
    let playerDeaths = 0;
    for (const e of g.events) {
      if (!e.isPlayerInvolved) continue;
      if (e.eventType === "CHAMPION_KILL") playerKills += 1;
      else if (e.eventType === "PLAYER_DEATH") playerDeaths += 1;
    }
    let situation;
    if (playerKills > playerDeaths) situation = "PLAYER_DOMINANT";
    else if (playerDeaths > playerKills) situation = "PLAYER_DOWN";
    else situation = "TRADED";
    encounters.push({
      encounterId: `enc_${String(encounters.length + 1).padStart(3, "0")}`,
      phase: first.phase,
      startLabel: first.timestampLabel,
      endLabel: last.timestampLabel,
      eventCount: g.events.length,
      playerKills,
      playerDeaths,
      situation,
      relatedEventIds: g.events.map((e) => e.eventId),
    });
    if (encounters.length >= MAX_ENCOUNTERS) break;
  }
  return encounters;
}

// 한타 단계별 분석 — encounter(플레이어 킬/데스 시퀀스)를 진입/딜교환/정리로 분해.
// 데이터 한계: 이벤트는 CHAMPION_KILL/PLAYER_DEATH만 → 단계는 순서·간격으로 추론.
function buildTeamfightPhases(encounters, timelineEvents) {
  const byId = new Map((timelineEvents || []).map((e) => [e.eventId, e]));
  const teamfights = [];
  for (const enc of encounters || []) {
    if ((enc.eventCount ?? 0) < TEAMFIGHT_MIN_EVENTS) continue;
    const events = (enc.relatedEventIds || [])
      .map((id) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => (a.timestampMs ?? 0) - (b.timestampMs ?? 0));
    if (events.length < TEAMFIGHT_MIN_EVENTS) continue;
    const last = events.length - 1;

    const phaseObj = (name, evs) => {
      let pk = 0, pd = 0;
      for (const e of evs) {
        if (!e.isPlayerInvolved) continue;
        if (e.eventType === "CHAMPION_KILL") pk += 1;
        else if (e.eventType === "PLAYER_DEATH") pd += 1;
      }
      return {
        phase: name,
        startLabel: evs.length ? evs[0].timestampLabel : "",
        endLabel: evs.length ? evs[evs.length - 1].timestampLabel : "",
        playerKills: pk,
        playerDeaths: pd,
        outcomeTag: null,
        relatedEventIds: evs.map((e) => e.eventId),
      };
    };

    const engage = phaseObj("ENGAGE", [events[0]]);
    const trade = phaseObj("TRADE", events.slice(1, last));
    const cleanup = phaseObj("CLEANUP", [events[last]]);

    engage.outcomeTag = events[0].eventType === "CHAMPION_KILL" ? "INITIATED_KILL" : "CAUGHT_OUT";
    trade.outcomeTag =
      trade.playerKills > trade.playerDeaths ? "TRADE_WON"
        : trade.playerDeaths > trade.playerKills ? "TRADE_LOST" : "TRADE_EVEN";
    const lastEvt = events[last];
    const prevEvt = events[last - 1];
    if (lastEvt.eventType === "CHAMPION_KILL") {
      cleanup.outcomeTag = "CLOSED_OUT";
    } else {
      const gap = (lastEvt.timestampMs ?? 0) - (prevEvt.timestampMs ?? 0);
      cleanup.outcomeTag =
        prevEvt.eventType === "CHAMPION_KILL" || gap > CLEANUP_GAP_MS ? "OVERCHASE_DEATH" : "DIED_IN_FIGHT";
    }

    const phases = [engage, trade, cleanup].filter((p) => p.relatedEventIds.length > 0);
    teamfights.push({
      teamfightId: enc.encounterId,
      gamePhase: enc.phase,
      startLabel: events[0].timestampLabel,
      endLabel: events[last].timestampLabel,
      totalKills: enc.playerKills,
      totalDeaths: enc.playerDeaths,
      situation: enc.situation,
      phases,
    });
  }
  return teamfights;
}

// 단계 + outcomeTag별 룰 기반 코칭 한 줄 (AI 누락 시 폴백).
function teamfightPhaseCoaching(outcomeTag) {
  const map = {
    INITIATED_KILL: "한타 시작을 선제 킬/관여로 좋게 열었다.",
    CAUGHT_OUT: "한타 시작 직후 먼저 끊겨 인원·구도 손해로 출발했다.",
    TRADE_WON: "딜교환 구간에서 킬을 더 챙기며 이득을 봤다.",
    TRADE_LOST: "딜교환 구간에서 데스가 더 많아 손해를 봤다.",
    TRADE_EVEN: "딜교환은 비등하게 주고받았다.",
    CLOSED_OUT: "한타 마무리를 킬로 깔끔하게 정리했다.",
    OVERCHASE_DEATH: "한타가 정리되는 국면에서 무리한 추격으로 데스를 내줬다.",
    DIED_IN_FIGHT: "한타 막바지 교전에서 생존하지 못했다.",
  };
  return map[outcomeTag] || "";
}

function teamfightTakeaway(teamfight) {
  const tags = (teamfight.phases || []).map((p) => p.outcomeTag);
  if (tags.includes("CAUGHT_OUT")) return "한타 진입 전 시야와 포지션을 먼저 잡아 선제 피해를 줄이자.";
  if (tags.includes("OVERCHASE_DEATH")) return "이긴 한타는 추격보다 리셋·정리를 우선하자.";
  if (teamfight.situation === "PLAYER_DOMINANT") return "좋은 한타 흐름을 다음에도 반복하자.";
  return "한타 국면별 판단을 점검해 다음 교전에 적용하자.";
}

// 서버 구조 + AI 코칭 병합 — coaching/takeaway는 AI 우선, 없으면 룰 기반.
function mergeTeamfightCoaching(structure, aiArray) {
  const aiById = new Map((Array.isArray(aiArray) ? aiArray : []).map((t) => [t && t.teamfightId, t]));
  return (structure || []).map((tf) => {
    const ai = aiById.get(tf.teamfightId);
    const aiPhaseMap = new Map((ai && Array.isArray(ai.phases) ? ai.phases : []).map((p) => [p && p.phase, p]));
    const phases = tf.phases.map((p) => {
      const aiP = aiPhaseMap.get(p.phase);
      const coaching = aiP && typeof aiP.coaching === "string" && aiP.coaching.trim()
        ? aiP.coaching.trim()
        : teamfightPhaseCoaching(p.outcomeTag);
      return { ...p, coaching };
    });
    const takeaway = ai && typeof ai.takeaway === "string" && ai.takeaway.trim()
      ? ai.takeaway.trim()
      : teamfightTakeaway(tf);
    return { ...tf, phases, takeaway };
  });
}

function buildLlmPayload(normalized) {
  const filteredEvents = normalized.timelineEvents
    .filter((e) => e.importance >= 3)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 15)
    .sort((a, b) => a.timestampMs - b.timestampMs)
    .map(({ eventId, timestampLabel, phase, eventType, importance, summary, isPlayerInvolved }) => ({
      eventId, timestampLabel, phase, eventType, importance, summary, isPlayerInvolved,
    }));

  const combatEncounters = detectCombatEncounters(normalized.timelineEvents);
  const teamfightPhases = buildTeamfightPhases(combatEncounters, normalized.timelineEvents);

  const { early, mid, late } = normalized.phaseContext;
  return {
    taskMeta: { language: "ko", analysisMode: "coaching", strengthCount: INSIGHT_LIST_MIN, weaknessCount: INSIGHT_LIST_MIN, checklistCountMin: ACTION_CHECKLIST_MIN, checklistCountMax: ACTION_CHECKLIST_MAX },
    matchContext: {
      playerContext: { riotId: normalized.playerContext.riotId, participantId: normalized.playerContext.participantId },
      matchInfo: normalized.matchInfo,
      playerStats: normalized.playerStats,
      teamContext: normalized.teamContext,
    },
    phaseContext: {
      early: { kills: early.kills, deaths: early.deaths, assists: early.assists, notableEventCount: early.notableEventCount },
      mid:   { kills: mid.kills,   deaths: mid.deaths,   assists: mid.assists,   notableEventCount: mid.notableEventCount   },
      late:  { kills: late.kills,  deaths: late.deaths,  assists: late.assists,  notableEventCount: late.notableEventCount  },
    },
    timelineEvents: filteredEvents,
    combatEncounters,
    teamfightPhases,
    derivedSignals: normalized.derivedSignals,
    outputContract: {
      schemaVersion: "1.0",
      requiredTopLevelFields: ["schemaVersion", "analysisMeta", "matchSummary", "coachSummary", "phaseSummaries", "strengths", "weaknesses", "actionChecklist", "keyMoments", "evidenceIndex", "combatAnalysis", "teamfightPhaseAnalysis"],
      requiredArrayCounts: { phaseSummariesMin: PHASE_SUMMARIES_MIN, evidenceIndexMin: EVIDENCE_INDEX_MIN, strengths: INSIGHT_LIST_MIN, strengthsMax: INSIGHT_LIST_MAX, weaknesses: INSIGHT_LIST_MIN, weaknessesMax: INSIGHT_LIST_MAX, actionChecklistMin: ACTION_CHECKLIST_MIN, actionChecklistMax: ACTION_CHECKLIST_MAX, keyMomentsMin: KEY_MOMENTS_MIN },
      rules: ["JSON only", "No markdown", "Use Korean", "Prefer evidence-backed claims", "Do not invent unsupported facts"],
    },
  };
}

// ─── CLI subprocess helper ────────────────────────────────────────────────────

// subprocess에서 CLI를 찾을 수 있도록 PATH 보강 (node 프로세스는 shell PATH 미상속 가능)
// path.delimiter로 cross-platform 안전 (unix `:`, win32 `;`)
const AUGMENTED_PATH = [
  process.env.PATH,
  // unix-only 표준 위치
  process.platform !== "win32" && "/opt/homebrew/bin",
  process.platform !== "win32" && "/usr/local/bin",
  // 사용자 home의 .local/bin — claude/codex CLI는 보통 여기로 설치됨
  process.env.HOME && `${process.env.HOME}/.local/bin`,
  process.env.USERPROFILE && `${process.env.USERPROFILE}\\.local\\bin`,
  // codex CLI sandbox 변종 (win32) — Windows 설치 시 기본 위치
  process.env.USERPROFILE && `${process.env.USERPROFILE}\\.codex\\.sandbox-bin`,
  // 옵션: .env의 EXTRA_CLI_PATH로 추가 경로 지정 가능 (path.delimiter 구분)
  ...parseExtraCliPathConfig(process.env.EXTRA_CLI_PATH),
].filter(Boolean).join(path.delimiter);

function runCli(args, stdinText, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn, val) => { if (!settled) { settled = true; fn(val); } };

    const env = { ...process.env, PATH: AUGMENTED_PATH };
    const proc = spawn(args[0], args.slice(1), { stdio: ["pipe", "pipe", "pipe"], env });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (c) => { stdout += c; });
    proc.stderr.on("data", (c) => { stderr += c; });
    proc.stdin.on("error", () => {}); // EPIPE 억제

    const timer = setTimeout(() => {
      proc.kill();
      settle(reject, new Error(`timeout: ${args[0]}`));
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        // Phase 30: 일부 CLI(특히 codex)는 stderr는 비워두고 stdout JSONL에
        // turn.failed 형태로 에러를 출력. 빈 stderr면 stdout tail도 포함.
        const tail = stderr.trim() || stdout.trim().slice(-300);
        settle(reject, new Error(`${args[0]} exited ${code}: ${tail.slice(0, 300)}`));
        return;
      }
      settle(resolve, stdout);
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      const msg = err.code === "ENOENT" ? `${args[0]} CLI not found in PATH` : err.message;
      settle(reject, new Error(msg));
    });

    proc.stdin.write(stdinText, "utf8");
    proc.stdin.end();
  });
}

// ─── Claude: 코칭 분석 에이전트 ──────────────────────────────────────────────

// Track C: 출력 스키마를 텍스트가 아니라 미니 예제로 제시해 타입(object vs array,
// string vs object) 위반 빈도를 줄인다. 누락/이름변경/중첩 금지를 명시.
const OUTPUT_SCHEMA_EXAMPLE = `정확히 다음 JSON 키 구조를 따른다. 키 이름 변경/누락/중첩 금지.
matchSummary는 객체이며 headline은 문자열이다. coachSummary는 객체이며 overallSummary는 문자열이다.
phaseSummaries는 3개 이상의 배열이다 (객체 아님). keyMoments는 4개 이상의 배열이다.
strengths와 weaknesses는 각각 3개의 배열이다.
actionChecklist는 3~5개의 배열이다.
evidenceIndex는 1개 이상의 배열이며 각 항목은 eventId와 shortNote 또는 summary를 포함한다.
combatAnalysis는 배열이다. 입력 payload의 combatEncounters 각 항목당 1개씩 작성하되, 입력에 encounter가 없으면 빈 배열을 반환한다.
teamfightPhaseAnalysis는 배열이다. 입력 payload의 teamfightPhases 각 항목당 1개씩 작성하되, 입력에 teamfightPhases가 없으면 빈 배열을 반환한다.

{
  "schemaVersion": "1.0",
  "analysisMeta": { "sourceType": "...", "language": "ko" },
  "matchSummary": { "headline": "한 줄 요약 문장" },
  "coachSummary": { "overallSummary": "전체 흐름 요약 문장" },
  "phaseSummaries": [
    { "phase": "EARLY", "summary": "..." },
    { "phase": "MID", "summary": "..." },
    { "phase": "LATE", "summary": "..." }
  ],
  "strengths": [{ "id": "str_1", "title": "...", "description": "...", "relatedEventIds": ["evt_001"] }],
  "weaknesses": [{ "id": "wk_1", "title": "...", "description": "...", "relatedEventIds": ["evt_002"] }],
  "actionChecklist": [{ "id": "act_1", "text": "...", "linkedWeaknessId": "wk_1" }],
  "keyMoments": [{ "id": "km_1", "timestampLabel": "...", "phase": "EARLY", "title": "...", "description": "...", "relatedEventIds": ["evt_003"] }],
  "combatAnalysis": [{ "encounterId": "enc_001", "situationLabel": "초반 갱킹 손실", "playerDecision": "정글 시야 없이 라인 푸시 진입", "takeaway": "갱킹 위험 시간대(2~5분)에는 부쉬 핑크 와드 우선", "relatedEventIds": ["evt_004"] }],
  "teamfightPhaseAnalysis": [{
    "teamfightId": "enc_001",
    "phases": [
      { "phase": "ENGAGE", "outcomeTag": "INITIATED_KILL", "playerKills": 1, "playerDeaths": 0, "coaching": "진입 국면 코칭 한 줄", "relatedEventIds": ["evt_004"] },
      { "phase": "TRADE", "outcomeTag": "TRADE_EVEN", "playerKills": 0, "playerDeaths": 0, "coaching": "딜교환 코칭", "relatedEventIds": ["evt_005"] },
      { "phase": "CLEANUP", "outcomeTag": "CLOSED_OUT", "playerKills": 1, "playerDeaths": 0, "coaching": "정리 국면 코칭", "relatedEventIds": ["evt_006"] }
    ],
    "takeaway": "이 한타 핵심 교훈"
  }],
  "evidenceIndex": [{ "eventId": "evt_001", "shortNote": "..." }]
}`;

const CLAUDE_COACHING_PROMPT = `당신은 League of Legends 경기 복기 코치다.
입력 경기 데이터를 바탕으로 플레이어가 잘한 점과 개선점을 균형 있게 분석한다.
모든 인사이트는 이벤트와 지표에 근거해야 한다. 플레이어를 비난하지 말고 코칭형 문장을 사용한다.
출력은 반드시 JSON만. 코드블록 마커 없음.

${OUTPUT_SCHEMA_EXAMPLE}

장점 3개, 단점 3개, 다음 게임 체크리스트 3~5개, 핵심 장면 4개 이상.
모든 장점/단점에 relatedEventIds 포함. analysisMeta.sourceType = "claude_ai".

combatAnalysis: 입력 payload의 combatEncounters 각 encounter마다 1개 항목 작성. situationLabel은
교전 상황(예: "초반 라인전 솔로킬", "오브젝트 셋업 중 cut off", "한타 백라인 진입 후 cut off")을 한 줄로 요약,
playerDecision은 그 순간 플레이어의 판단/포지셔닝을 사실 기반으로 기술, takeaway는 다음에 같은 상황에서
적용할 짧은 교훈. encounterId와 relatedEventIds는 입력값을 그대로 반영. 입력 encounter가 0개면
combatAnalysis는 빈 배열.

teamfightPhaseAnalysis: 입력 payload의 teamfightPhases 각 항목(\`teamfightId\`)마다 1개씩 작성. 각 \`phases\` row는 입력 phase row의 \`phase\`, \`outcomeTag\`, \`playerKills\`, \`playerDeaths\`, \`relatedEventIds\`를 그대로 반영하고, \`coaching\`은 그 국면 판단 코칭 한 줄로 작성. \`takeaway\`는 이 한타의 핵심 교훈 한 줄. 입력 teamfightPhases가 0개면 빈 배열.

분석할 경기 데이터:`;

async function callClaudeAgent(payload, timeoutMs = 300000) {
  const stdinText = `${CLAUDE_COACHING_PROMPT}\n\n${JSON.stringify(payload, null, 2)}`;
  const raw = await runCli(["claude", "--print", "--output-format", "json"], stdinText, timeoutMs);

  // --output-format json → { result: "...", ... }
  let text;
  try {
    const wrapper = JSON.parse(raw);
    text = (wrapper.result ?? raw).trim();
  } catch {
    text = raw.trim();
  }

  if (text.startsWith("```")) text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(text);
}

// ─── Codex: 레드팀 비판 에이전트 ─────────────────────────────────────────────

const CODEX_REDTEAM_PROMPT = `당신은 League of Legends 경기 분석 레드팀 에이전트다.
일반 코칭 분석이 놓치기 쉬운 구조적 문제와 숨겨진 패턴을 찾아내는 것이 목적이다.
아래 관점으로 집중 검토하라:
- 표면적으로 좋아 보이지만 실제로 비효율적인 플레이
- 통계에 드러나지 않는 반복 패턴과 판단 오류
- 상위 티어에서 더 크게 노출될 구조적 약점
- 승리 요인으로 여겨지는 플레이 중 운이나 상대 실수에 의존한 부분

같은 JSON 출력 스키마를 사용하되, 더 비판적이고 구체적인 시각으로 작성하라.
출력은 JSON만. 코드블록 마커 없음.

${OUTPUT_SCHEMA_EXAMPLE}

장점 3개, 단점 3개, 다음 게임 체크리스트 3~5개, 핵심 장면 4개 이상.
모든 장점/단점에 relatedEventIds 포함. analysisMeta.sourceType = "codex_redteam".

combatAnalysis: 입력 payload의 combatEncounters 각 encounter마다 1개 항목 작성. 레드팀 관점으로
판단 실수와 구조적 약점을 더 날카롭게 지적. 입력 encounter가 0개면 빈 배열.

teamfightPhaseAnalysis: 입력 payload의 teamfightPhases 각 항목(\`teamfightId\`)마다 1개씩 작성. 각 \`phases\` row는 입력 phase row의 \`phase\`, \`outcomeTag\`, \`playerKills\`, \`playerDeaths\`, \`relatedEventIds\`를 그대로 반영하고, \`coaching\`은 레드팀 관점에서 국면별 판단 실수를 날카롭게 지적. \`takeaway\`는 이 한타의 핵심 교훈 한 줄. 입력 teamfightPhases가 0개면 빈 배열.

분석할 경기 데이터:`;

async function callCodexAgent(payload, timeoutMs = 300000) {
  const stdinText = `${CODEX_REDTEAM_PROMPT}\n\n${JSON.stringify(payload, null, 2)}`;

  // codex exec - : stdin으로 프롬프트 전달
  // --json       : JSONL 이벤트 스트림 출력
  // --ephemeral  : 세션 저장 없음
  // -s read-only : 파일시스템 조작 차단
  // --color never: ANSI 코드 제거
  const raw = await runCli(
    ["codex", "exec", "-", "--json", "--ephemeral", "-s", "read-only", "--color", "never"],
    stdinText,
    timeoutMs,
  );

  // JSONL 파싱: item.type === "agent_message" 에서 text 추출 (실측 포맷 기준)
  let text = "";
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const evt = JSON.parse(trimmed);
      if (evt.type === "item.completed" && evt.item?.type === "agent_message") {
        text = evt.item.text ?? "";
      }
    } catch { /* 파싱 불가 줄 무시 */ }
  }

  // JSONL에서 추출 실패 시 raw 전체 시도
  if (!text) text = raw;
  text = text.trim();
  if (text.startsWith("```")) text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(text);
}

// ─── Output schema validator ──────────────────────────────────────────────────

function hasMinimumKeyMoments(keyMoments) {
  return Array.isArray(keyMoments) && keyMoments.length >= KEY_MOMENTS_MIN;
}

function hasValidKeyMoments(keyMoments) {
  return Array.isArray(keyMoments) &&
    keyMoments.length >= KEY_MOMENTS_MIN &&
    keyMoments.every((item) =>
      item &&
      (
        (typeof item.id === "string" && item.id) ||
        (typeof item.eventId === "string" && item.eventId)
      ) &&
      (
        (typeof item.timestampLabel === "string" && item.timestampLabel) ||
        (typeof item.timestamp === "string" && item.timestamp)
      ) &&
      typeof item.phase === "string" &&
      item.phase &&
      (
        (typeof item.title === "string" && item.title) ||
        (typeof item.label === "string" && item.label)
      ) &&
      (
        (typeof item.description === "string" && item.description) ||
        (typeof item.reason === "string" && item.reason)
      ) &&
      Array.isArray(item.relatedEventIds) &&
      item.relatedEventIds.every((id) => typeof id === "string" && id)
    );
}

function hasValidPhaseSummaries(phaseSummaries) {
  return Array.isArray(phaseSummaries) &&
    phaseSummaries.length >= PHASE_SUMMARIES_MIN &&
    phaseSummaries.every((item) =>
      item &&
      typeof item.phase === "string" &&
      item.phase &&
      typeof item.summary === "string" &&
      item.summary
    );
}

function hasAnalysisMetaObject(analysisMeta) {
  return Boolean(analysisMeta) && typeof analysisMeta === "object" && !Array.isArray(analysisMeta);
}

function isNonBlankString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasValidMatchSummary(matchSummary) {
  return Boolean(matchSummary) &&
    typeof matchSummary === "object" &&
    !Array.isArray(matchSummary) &&
    isNonBlankString(matchSummary.headline);
}

function hasValidCoachSummary(coachSummary) {
  return Boolean(coachSummary) &&
    typeof coachSummary === "object" &&
    !Array.isArray(coachSummary) &&
    isNonBlankString(coachSummary.overallSummary);
}

function hasValidEvidenceIndex(evidenceIndex) {
  return Array.isArray(evidenceIndex) &&
    evidenceIndex.length >= EVIDENCE_INDEX_MIN &&
    evidenceIndex.every((item) =>
      item &&
      isNonBlankString(item.eventId) &&
      (
        isNonBlankString(item.summary) ||
        isNonBlankString(item.shortNote)
      )
    );
}

function hasValidActionChecklist(actionChecklist) {
  return Array.isArray(actionChecklist) &&
    actionChecklist.length >= ACTION_CHECKLIST_MIN &&
    actionChecklist.length <= ACTION_CHECKLIST_MAX &&
    actionChecklist.every((item) =>
      item &&
      typeof item.id === "string" &&
      item.id &&
      (
        (typeof item.text === "string" && item.text) ||
        (typeof item.action === "string" && item.action)
      )
    );
}

function hasValidInsightList(items) {
  return Array.isArray(items) &&
    items.length >= INSIGHT_LIST_MIN &&
    items.length <= INSIGHT_LIST_MAX &&
    items.every((item) =>
      item &&
      typeof item.id === "string" &&
      item.id &&
      typeof item.title === "string" &&
      item.title &&
      typeof item.description === "string" &&
      item.description &&
      Array.isArray(item.relatedEventIds) &&
      item.relatedEventIds.every((id) => typeof id === "string" && id)
    );
}

function hasValidCombatAnalysis(combatAnalysis) {
  return combatAnalysis === undefined ||
    combatAnalysis === null ||
    (
      Array.isArray(combatAnalysis) &&
      combatAnalysis.every((item) =>
        item &&
        isNonBlankString(item.encounterId) &&
        isNonBlankString(item.situationLabel) &&
        isNonBlankString(item.playerDecision) &&
        isNonBlankString(item.takeaway) &&
        Array.isArray(item.relatedEventIds) &&
        item.relatedEventIds.every((id) => isNonBlankString(id))
      )
    );
}

function hasValidTeamfightPhaseAnalysis(teamfightPhaseAnalysis) {
  return teamfightPhaseAnalysis === undefined ||
    teamfightPhaseAnalysis === null ||
    (
      Array.isArray(teamfightPhaseAnalysis) &&
      teamfightPhaseAnalysis.every((tf) =>
        tf &&
        isNonBlankString(tf.teamfightId) &&
        isNonBlankString(tf.takeaway) &&
        Array.isArray(tf.phases) &&
        tf.phases.length > 0 &&
        tf.phases.every((phase) =>
          phase &&
          isNonBlankString(phase.phase) &&
          isNonBlankString(phase.outcomeTag) &&
          Number.isInteger(phase.playerKills) &&
          phase.playerKills >= 0 &&
          Number.isInteger(phase.playerDeaths) &&
          phase.playerDeaths >= 0 &&
          isNonBlankString(phase.coaching) &&
          Array.isArray(phase.relatedEventIds) &&
          phase.relatedEventIds.every((id) => isNonBlankString(id))
        )
      )
    );
}

function validateAnalysisOutput(json) {
  if (typeof json?.schemaVersion !== "string") throw new Error("missing schemaVersion");
  if (!hasAnalysisMetaObject(json?.analysisMeta)) throw new Error("missing analysisMeta");
  if (typeof json.analysisMeta.sourceType !== "string" || !json.analysisMeta.sourceType) throw new Error("missing analysisMeta.sourceType");
  if (typeof json.analysisMeta.language !== "string" || !json.analysisMeta.language) throw new Error("missing analysisMeta.language");
  if (!hasValidMatchSummary(json?.matchSummary)) throw new Error("missing matchSummary.headline");
  if (!hasValidCoachSummary(json?.coachSummary)) throw new Error("missing coachSummary.overallSummary");
  if (!hasValidPhaseSummaries(json?.phaseSummaries)) throw new Error(`phaseSummaries < ${PHASE_SUMMARIES_MIN}`);
  if (!hasValidInsightList(json?.strengths)) throw new Error("strengths invalid");
  if (!hasValidInsightList(json?.weaknesses)) throw new Error("weaknesses invalid");
  if (!hasValidActionChecklist(json?.actionChecklist)) throw new Error("actionChecklist invalid");
  if (!hasValidKeyMoments(json?.keyMoments)) throw new Error("keyMoments invalid");
  if (!hasValidEvidenceIndex(json?.evidenceIndex)) throw new Error("evidenceIndex invalid");
  // Phase 32: combatAnalysis는 선택적 — 없거나 빈 배열이면 통과 (기존 코호트 backward-compat).
  // 있으면 UI가 렌더링하는 판단/교훈/근거 링크 필드까지 검증.
  if (json.combatAnalysis !== undefined && json.combatAnalysis !== null) {
    if (!Array.isArray(json.combatAnalysis)) throw new Error("combatAnalysis not array");
    for (const item of json.combatAnalysis) {
      if (!item || !isNonBlankString(item.encounterId)) throw new Error("combatAnalysis item missing encounterId");
      if (!isNonBlankString(item.situationLabel)) throw new Error("combatAnalysis item missing situationLabel");
      if (!isNonBlankString(item.playerDecision)) throw new Error("combatAnalysis item missing playerDecision");
      if (!isNonBlankString(item.takeaway)) throw new Error("combatAnalysis item missing takeaway");
      if (!Array.isArray(item.relatedEventIds) || !item.relatedEventIds.every((id) => isNonBlankString(id))) {
        throw new Error("combatAnalysis item missing relatedEventIds");
      }
    }
  }
  // 한타 단계별 분석은 선택적 — 있으면 UI가 렌더링하는 phase/coaching shape까지 검증.
  if (!hasValidTeamfightPhaseAnalysis(json.teamfightPhaseAnalysis)) {
    if (!Array.isArray(json.teamfightPhaseAnalysis)) throw new Error("teamfightPhaseAnalysis not array");
    for (const tf of json.teamfightPhaseAnalysis) {
      if (!tf || !isNonBlankString(tf.teamfightId)) throw new Error("teamfightPhaseAnalysis item missing teamfightId");
      if (!isNonBlankString(tf.takeaway)) throw new Error("teamfightPhaseAnalysis item missing takeaway");
      if (!Array.isArray(tf.phases) || tf.phases.length === 0) throw new Error("teamfightPhaseAnalysis item phases not array");
      for (const phase of tf.phases) {
        if (!phase || !isNonBlankString(phase.phase)) throw new Error("teamfightPhaseAnalysis phase missing phase");
        if (!isNonBlankString(phase.outcomeTag)) throw new Error("teamfightPhaseAnalysis phase missing outcomeTag");
        if (!Number.isInteger(phase.playerKills) || phase.playerKills < 0) throw new Error("teamfightPhaseAnalysis phase missing playerKills");
        if (!Number.isInteger(phase.playerDeaths) || phase.playerDeaths < 0) throw new Error("teamfightPhaseAnalysis phase missing playerDeaths");
        if (!isNonBlankString(phase.coaching)) throw new Error("teamfightPhaseAnalysis phase missing coaching");
        if (!Array.isArray(phase.relatedEventIds) || !phase.relatedEventIds.every((id) => isNonBlankString(id))) {
          throw new Error("teamfightPhaseAnalysis phase missing relatedEventIds");
        }
      }
    }
  }
}

// ─── Red-team comparison builder ─────────────────────────────────────────────

function buildComparison(claudeResult, codexResult, sampleId) {
  function keywords(text) {
    return (text ?? "").replace(/[^가-힣a-z0-9\s]/gi, " ").toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  }
  function overlaps(titleA, titleB) {
    const ka = new Set(keywords(titleA));
    return keywords(titleB).some((w) => ka.has(w));
  }

  const agreements = [];
  const claudeOnly = [];
  const codexOnly = [];

  const claudeStrengths = claudeResult?.strengths ?? [];
  const codexStrengths  = codexResult?.strengths  ?? [];
  const claudeWeaknesses = claudeResult?.weaknesses ?? [];
  const codexWeaknesses  = codexResult?.weaknesses  ?? [];

  for (const cs of claudeStrengths) {
    const match = codexStrengths.find((ds) => overlaps(cs.title, ds.title));
    if (match) agreements.push({ category: "strength", topic: cs.title, claudeNote: cs.description, codexNote: match.description });
    else claudeOnly.push({ category: "strength", topic: cs.title, note: cs.description });
  }
  for (const ds of codexStrengths) {
    if (!claudeStrengths.find((cs) => overlaps(ds.title, cs.title))) {
      codexOnly.push({ category: "strength", topic: ds.title, note: ds.description });
    }
  }
  for (const cw of claudeWeaknesses) {
    const match = codexWeaknesses.find((dw) => overlaps(cw.title, dw.title));
    if (match) agreements.push({ category: "weakness", topic: cw.title, claudeNote: cw.description, codexNote: match.description });
    else claudeOnly.push({ category: "weakness", topic: cw.title, note: cw.description });
  }
  for (const dw of codexWeaknesses) {
    if (!claudeWeaknesses.find((cw) => overlaps(dw.title, cw.title))) {
      codexOnly.push({ category: "weakness", topic: dw.title, note: dw.description });
    }
  }

  const total = claudeStrengths.length + claudeWeaknesses.length;
  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    sampleId,
    primaryAgent: claudeResult ? "claude" : "codex",
    redTeamAgent: "codex",
    claudeAnalysis: claudeResult ?? null,
    codexAnalysis: codexResult ?? null,
    comparison: {
      agreements,
      claudeOnly,
      codexOnly,
      agreementRate: total > 0 ? Math.round((agreements.length / total) * 100) : 0,
    },
  };
}

// ─── Main analysis orchestrator ───────────────────────────────────────────────

async function buildAnalysis(normalized, sampleId) {
  const payload = buildLlmPayload(normalized);

  // Phase 30: AGENT_DISABLE_CODEX=1 환경변수로 Codex 비활성 (.env 또는 export).
  // 노후 CLI / 모델 미호환 / 인증 부재 등으로 Codex가 매번 실패하는 환경에서는
  // 이 hook을 켜 깨끗한 single-agent 모드로 운용. Track C 측정은 Claude 단독으로
  // 유지되며 fallback 체인은 Claude 실패 시 rule-based로 직행.
  const codexDisabled = parseAgentDisableCodexConfig(process.env.AGENT_DISABLE_CODEX);
  if (codexDisabled) {
    console.log(`[AI] Codex disabled via AGENT_DISABLE_CODEX=1 — Claude only for ${sampleId}`);
  }

  const [claudeSettled, codexSettled] = await Promise.allSettled([
    callClaudeAgent(payload),
    codexDisabled
      ? Promise.reject(new Error("disabled via AGENT_DISABLE_CODEX"))
      : callCodexAgent(payload),
  ]);

  const claudeOk = claudeSettled.status === "fulfilled";
  const codexOk  = codexSettled.status === "fulfilled";

  if (!claudeOk) console.error(`[AI] Claude failed for ${sampleId}:`, claudeSettled.reason?.message);
  if (!codexOk)  console.error(`[AI] Codex failed for ${sampleId}:`,  codexSettled.reason?.message);

  const claudeResult = claudeOk ? claudeSettled.value : null;
  const codexResult  = codexOk  ? codexSettled.value  : null;

  let primary = claudeResult ?? codexResult;

  if (!primary) {
    console.error(`[AI] Both agents failed for ${sampleId}, using rule-based fallback`);
    return buildRuleBasedAnalysis(normalized, sampleId);
  }

  // Track C: 서버측 스키마 정규화가 실제로 발동된 케이스를 카운트해 manifest에
  // 노출. 후속 회귀 추적용. 각 항목은 정규화가 fire되면 push (push 횟수 = 위반 수).
  const violations = [];

  // 모델이 생략하기 쉬운 필드 서버측 보완 (AI 콘텐츠는 최대한 유지)
  if (!primary.schemaVersion) { primary.schemaVersion = "1.0"; violations.push("missing.schemaVersion"); }
  const inferredPrimarySourceType = primary === claudeResult ? "claude_ai" : "codex_redteam";
  if (!hasAnalysisMetaObject(primary.analysisMeta)) {
    const violation = primary.analysisMeta ? "type.analysisMeta.invalid" : "missing.analysisMeta";
    primary.analysisMeta = {};
    violations.push(violation);
  }
  if (typeof primary.analysisMeta.sourceType !== "string" || !primary.analysisMeta.sourceType) {
    primary.analysisMeta.sourceType = inferredPrimarySourceType;
    violations.push("missing.analysisMeta.sourceType");
  }
  if (typeof primary.analysisMeta.language !== "string" || !primary.analysisMeta.language) {
    primary.analysisMeta.language = "ko";
    violations.push("missing.analysisMeta.language");
  }

  // matchSummary: AI가 string으로 반환하는 경우 → 객체로 정규화
  if (typeof primary.matchSummary === "string") {
    primary.matchSummary = { headline: primary.matchSummary };
    violations.push("type.matchSummary.string");
  } else if (!primary.matchSummary || typeof primary.matchSummary !== "object" || Array.isArray(primary.matchSummary)) {
    primary.matchSummary = {};
    violations.push("type.matchSummary.invalid");
  }
  if (!hasValidMatchSummary(primary.matchSummary)) {
    const fb = buildRuleBasedAnalysis(normalized, sampleId);
    primary.matchSummary.headline = fb.matchSummary.headline;
    violations.push("missing.matchSummary.headline");
  }
  // coachSummary: AI가 string으로 반환하는 경우 → 객체로 정규화
  if (typeof primary.coachSummary === "string") {
    primary.coachSummary = { overallSummary: primary.coachSummary };
    violations.push("type.coachSummary.string");
  } else if (!primary.coachSummary || typeof primary.coachSummary !== "object" || Array.isArray(primary.coachSummary)) {
    primary.coachSummary = {};
    violations.push("type.coachSummary.invalid");
  }
  if (!hasValidCoachSummary(primary.coachSummary)) {
    const fb = buildCoachSummary(normalized);
    primary.coachSummary.overallSummary = fb.overallSummary;
    violations.push("missing.coachSummary.overallSummary");
  }
  // phaseSummaries: AI가 배열 대신 객체로 반환하는 경우 → 배열로 정규화
  if (primary.phaseSummaries && !Array.isArray(primary.phaseSummaries)) {
    const ps = primary.phaseSummaries;
    primary.phaseSummaries = ["early", "mid", "late"]
      .filter((k) => ps[k])
      .map((k) => {
        const v = ps[k];
        return typeof v === "string" ? { phase: k.toUpperCase(), summary: v } : { phase: k.toUpperCase(), ...v };
      });
    violations.push("type.phaseSummaries.object");
  }
  if (!hasValidPhaseSummaries(primary.phaseSummaries)) {
    primary.phaseSummaries = buildPhaseSummaries(normalized);
    violations.push(`count.phaseSummaries<${PHASE_SUMMARIES_MIN}`);
  }
  if (!hasValidKeyMoments(primary.keyMoments)) {
    primary.keyMoments = buildKeyMoments(normalized);
    violations.push("shape.keyMoments.invalid");
  }
  if (!hasValidEvidenceIndex(primary.evidenceIndex)) {
    primary.evidenceIndex = buildEvidenceIndex(normalized);
    violations.push("missing.evidenceIndex");
  }
  if (!hasValidInsightList(primary.strengths)) {
    primary.strengths = buildStrengths(normalized);
    violations.push("shape.strengths.invalid");
  }
  if (!hasValidInsightList(primary.weaknesses)) {
    primary.weaknesses = buildWeaknesses(normalized);
    violations.push("shape.weaknesses.invalid");
  }
  if (!hasValidActionChecklist(primary.actionChecklist)) {
    const checklistWeaknesses = Array.isArray(primary.weaknesses) && primary.weaknesses.length > 0
      ? primary.weaknesses
      : buildWeaknesses(normalized);
    primary.actionChecklist = buildActionChecklist(normalized, checklistWeaknesses);
    violations.push("shape.actionChecklist.invalid");
  }
  // Phase 32: combatAnalysis 정규화 — 선택 필드이므로 깨진 AI 응답은 빈 배열로 복구.
  if (primary.combatAnalysis === undefined || primary.combatAnalysis === null) {
    primary.combatAnalysis = [];
  } else if (!hasValidCombatAnalysis(primary.combatAnalysis)) {
    primary.combatAnalysis = [];
    violations.push("shape.combatAnalysis.invalid");
  }

  // 한타 단계별 분석: payload의 결정론적 구조 + AI 코칭 병합 (AI 누락/오형식 시 룰 기반 폴백)
  primary.teamfightPhaseAnalysis = mergeTeamfightCoaching(
    payload.teamfightPhases,
    Array.isArray(primary.teamfightPhaseAnalysis) ? primary.teamfightPhaseAnalysis : [],
  );

  try {
    validateAnalysisOutput(primary);
  } catch (err) {
    console.error(`[AI] Schema validation failed for ${sampleId}:`, err.message, "— using rule-based fallback");
    return buildRuleBasedAnalysis(normalized, sampleId);
  }

  // analysisMeta 서버측 강제 정규화
  primary.analysisMeta.analysisId  = `ai_${sampleId}_${Date.now()}`;
  primary.analysisMeta.generatedAt = new Date().toISOString();
  // Track C: 위반 패턴 + 카운트 (빈 배열이어도 등재해 측정 코호트 일관성 유지)
  primary.analysisMeta.schemaViolations = violations;
  primary.analysisMeta.schemaViolationCount = violations.length;

  // 비교 결과를 임시 필드로 전달 (handleGenerateSample에서 분리 저장)
  primary.__comparison = buildComparison(claudeResult, codexResult, sampleId);

  console.log(
    `[AI] Analysis complete for ${sampleId} — primary: ${primary.analysisMeta.sourceType}` +
    ` · schemaViolations=${violations.length}` +
    (violations.length > 0 ? ` (${violations.join(", ")})` : "")
  );
  return primary;
}

// Riot 한도 100req/2min → 1.2초 간격 sleep. handleChampionHistory의 매치 페치 루프에서 사용.
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function writeSseHeaders(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
}

function writeSseEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function getCurrentSeasonRankedMatchIds(cluster, headers, puuid, queueId, onProgress) {
  const ids = [];
  let start = 0;
  const count = 100;
  while (true) {
    const url = `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?queue=${queueId}&startTime=${SEASON_START_EPOCH}&start=${start}&count=${count}`;
    const batch = await requestJson(url, headers);
    if (!Array.isArray(batch) || batch.length === 0) break;
    ids.push(...batch);
    if (typeof onProgress === "function") onProgress({ queueId, fetched: ids.length });
    if (batch.length < count) break;
    start += count;
    await sleep(1200);
  }
  return ids;
}

function requestJson(urlString, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const err = new Error(`Riot API ${res.statusCode}: ${body}`);
            err.riotStatus = res.statusCode;
            err.riotBody = body;
            reject(err);
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    req.on("error", reject);
    req.end();
  });
}

// Track B: Riot 401/403/429 -> 사용자 친화적 코드 + 힌트로 normalize.
// 그 외 Riot/live API 오류는 외부 세부 정보를 숨기는 고정 500 코드로 normalize.
function genericRiotApiErrorPayload() {
  return {
    status: 500,
    body: {
      ok: false,
      code: "RIOT_API_ERROR",
      error: "Riot API 요청을 처리하는 중 오류가 발생했습니다.",
    },
  };
}

function rankedLookupErrorMessage() {
  return "랭크 정보를 불러오지 못했습니다. 잠시 후 다시 시도하세요.";
}

function championHistoryMatchErrorMessage() {
  return "일부 경기 정보를 불러오지 못했습니다.";
}

function riotErrorPayload(error) {
  if (
    error &&
    Number.isInteger(error.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode <= 599 &&
    (error.code === "INVALID_JSON_BODY" || error.code === "REQUEST_BODY_TOO_LARGE")
  ) {
    return {
      status: error.statusCode,
      body: {
        ok: false,
        code: error.code,
        error: error.message || "요청 처리 중 오류가 발생했습니다.",
      },
    };
  }

  const status = error && typeof error.riotStatus === "number" ? error.riotStatus : null;
  if (status === 401 || status === 403) {
    return {
      status: 401,
      body: {
        ok: false,
        code: "RIOT_KEY_EXPIRED",
        error: "Riot 개발 키가 만료되었거나 유효하지 않습니다.",
        hint: "developer.riotgames.com에서 새 키를 발급한 뒤 .env의 RIOT_API_KEY를 갱신하고 서버를 재시작하세요.",
      },
    };
  }
  if (status === 429) {
    return {
      status: 429,
      body: {
        ok: false,
        code: "RIOT_RATE_LIMITED",
        error: "Riot API 호출 한도에 걸렸습니다. 잠시 후 다시 시도하세요.",
      },
    };
  }
  return genericRiotApiErrorPayload();
}

async function loadManifest() {
  return validateManifest(await readJson(manifestPath));
}

async function saveManifest(manifest) {
  await writeJson(manifestPath, validateManifest(manifest));
}

async function loadSampleBundle(sampleId) {
  const manifest = await loadManifest();
  const entry = manifest.samples.find((sample) => sample.id === sampleId);
  if (!entry) {
    return null;
  }

  let normalized;
  let analysis;
  try {
    normalized = await readJson(sampleEntryStoragePath(entry.normalizedPath));
    analysis = await readJson(sampleEntryStoragePath(entry.analysisPath));
  } catch {
    const error = new Error("Stored sample bundle is unavailable.");
    error.statusCode = 500;
    error.payload = {
      ok: false,
      code: "SAMPLE_BUNDLE_UNAVAILABLE",
      error: "저장 샘플 리포트 파일을 읽을 수 없습니다.",
      sampleId,
    };
    throw error;
  }

  // 누락된 필드 서버측 보강 (기존 샘플 호환)
  if (!normalized.playtimeScore && normalized.playerStats && normalized.timelineEvents) {
    normalized.playtimeScore = buildPlaytimeScore(normalized);
  }
  if (!normalized.objectiveTimeline) {
    // raw-timeline.json이 있으면 objectiveTimeline 생성
    const tlPath = sampleStoragePath(sampleId, "raw-timeline.json");
    const matchPath = sampleStoragePath(sampleId, "raw-match.json");
    try {
      const timeline = await readJson(tlPath);
      const matchDetail = await readJson(matchPath);
      const participant = matchDetail.info.participants.find((p) => p.puuid === normalized.playerContext?.puuid);
      if (participant && timeline) {
        const ptMap = new Map();
        matchDetail.info.participants.forEach((p) => ptMap.set(p.participantId, p.teamId));
        normalized.objectiveTimeline = buildObjectiveTimeline(timeline, participant.teamId, ptMap);
      }
    } catch {}
  }
  if (!normalized.kdaTimeline && normalized.timelineEvents) {
    normalized.kdaTimeline = buildKdaTimeline(normalized);
  }
  if (!normalized.wardTimeline || !normalized.itemTimeline) {
    const tlPath2 = sampleStoragePath(sampleId, "raw-timeline.json");
    const matchPath2 = sampleStoragePath(sampleId, "raw-match.json");
    try {
      const tl2 = await readJson(tlPath2);
      const md2 = await readJson(matchPath2);
      const pt2 = md2.info.participants.find((p) => p.puuid === normalized.playerContext?.puuid);
      if (pt2 && tl2) {
        if (!normalized.wardTimeline) normalized.wardTimeline = buildWardTimeline(tl2, pt2.participantId);
        if (!normalized.itemTimeline) normalized.itemTimeline = buildItemTimeline(tl2, pt2.participantId);
      }
    } catch {}
  }
  if (!normalized.challengeStats) {
    const matchPath3 = sampleStoragePath(sampleId, "raw-match.json");
    try {
      const md3 = await readJson(matchPath3);
      const pt3 = md3.info.participants.find((p) => p.puuid === normalized.playerContext?.puuid);
      if (pt3?.challenges) {
        const c = pt3.challenges;
        normalized.challengeStats = {
          damagePerMinute: c.damagePerMinute || 0, goldPerMinute: c.goldPerMinute || 0,
          visionScorePerMinute: c.visionScorePerMinute || 0, killParticipation: c.killParticipation || 0,
          teamDamagePercentage: c.teamDamagePercentage || 0, soloKills: c.soloKills || 0,
          laneMinionsFirst10Minutes: c.laneMinionsFirst10Minutes || 0,
          maxCsAdvantageOnLaneOpponent: c.maxCsAdvantageOnLaneOpponent || 0,
          maxLevelLeadLaneOpponent: c.maxLevelLeadLaneOpponent || 0,
          turretPlatesTaken: c.turretPlatesTaken || 0,
          earlyLaningPhaseGoldExpAdvantage: c.earlyLaningPhaseGoldExpAdvantage || 0,
          controlWardsPlaced: c.controlWardsPlaced || 0, skillshotsDodged: c.skillshotsDodged || 0,
          outnumberedKills: c.outnumberedKills || 0,
        };
      }
    } catch {}
  }

  let comparison = null;
  const compPath = sampleStoragePath(sampleId, "comparison-result.json");
  try { comparison = await readJson(compPath); } catch {}

  return {
    sampleId: entry.id,
    publicAlias: entry.publicAlias,
    collectedDate: entry.collectedDate,
    theme: entry.theme,
    normalized,
    analysis,
    comparison,
  };
}

function resolveApiKey(userKey) {
  const userApiKey = parseRiotApiKeyConfig(userKey);
  if (userApiKey) {
    return userApiKey;
  }
  return parseRiotApiKeyConfig(process.env.RIOT_API_KEY) || null;
}

const MAX_BODY_BYTES = 1 << 20; // 1MB — 본 API JSON 페이로드에 충분, 메모리 고갈 방지용 상한.
async function parseBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error("요청 본문이 너무 큽니다.");
      error.statusCode = 413;
      error.code = "REQUEST_BODY_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    const error = new Error("요청 본문이 올바른 JSON 형식이 아닙니다.");
    error.statusCode = 400;
    error.code = "INVALID_JSON_BODY";
    throw error;
  }
}

function validateRiotId(gameName, tagLine) {
  if (!gameName || gameName.length < 3 || gameName.length > 16) return "gameName은 3~16자여야 합니다.";
  if (!tagLine || tagLine.length < 2 || tagLine.length > 5) return "tagLine은 2~5자여야 합니다.";
  if (!/^[a-zA-Z0-9가-힣\s_.]+$/.test(gameName)) return "gameName에 허용되지 않는 문자가 있습니다.";
  if (!/^[a-zA-Z0-9]+$/.test(tagLine)) return "tagLine은 영문/숫자만 허용됩니다.";
  return null;
}

function sampleFitScore(match) {
  let score = 0;
  if ([420, 430, 440].includes(match.queueId)) score += 4;
  if (match.durationSeconds >= 1500 && match.durationSeconds <= 2100) score += 4;
  else if (match.durationSeconds >= 1300 && match.durationSeconds <= 2400) score += 2;
  if (match.role !== "UNKNOWN") score += 3;
  if (match.result === "LOSS") score += 2;
  else score += 1;
  if (["MID", "JUNGLE", "ADC", "SUPPORT", "TOP"].includes(match.role)) score += 2;
  return score;
}

function summarizeMatch(match, puuid) {
  const participant = match.info.participants.find((entry) => entry.puuid === puuid);
  if (!participant) {
    return null;
  }

  const role = normalizeRole(participant.teamPosition || participant.individualPosition);
  const dur = match.info.gameDuration || 1;
  const cs = (participant.totalMinionsKilled || 0) + (participant.neutralMinionsKilled || 0);

  const teamTotalKills = match.info.participants
    .filter((p) => p.teamId === participant.teamId)
    .reduce((sum, p) => sum + (p.kills || 0), 0);

  const summary = {
    matchId: match.metadata.matchId,
    queueId: match.info.queueId,
    queueLabel: queueLabel(match.info.queueId),
    durationSeconds: dur,
    durationLabel: durationLabel(dur),
    gameVersion: match.info.gameVersion,
    champion: participant.championName,
    role,
    result: participant.win ? "WIN" : "LOSS",
    kills: participant.kills,
    deaths: participant.deaths,
    assists: participant.assists,
    csPerMin: +(cs / (dur / 60)).toFixed(1),
    visionScore: participant.visionScore || 0,
    goldEarned: participant.goldEarned || 0,
    damageToChampions: participant.totalDamageDealtToChampions || 0,
    killParticipation: Math.min(1, +((participant.kills + participant.assists) / Math.max(1, teamTotalKills)).toFixed(2)),
    timestamp: match.info.gameCreation,
    items: [participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5, participant.item6],
    summonerSpells: [participant.summoner1Id, participant.summoner2Id],
  };

  return {
    ...summary,
    sampleFitScore: sampleFitScore(summary),
  };
}

async function handleRecentMatches(req, res) {
  const ip = getClientIp(req);
  if (!rateLimit(`recent:${ip}`, 10000)) {
    sendJson(res, 429, { ok: false, error: "요청이 너무 빠릅니다. 10초 후 다시 시도하세요." });
    return;
  }

  try {
    const body = await parseBody(req);
    const apiKey = resolveApiKey(body.riotApiKey);
    if (!apiKey) {
      sendJson(res, 500, { ok: false, error: "Riot API Key가 없습니다. 로그인 화면에서 키를 입력하거나 서버 .env를 확인하세요." });
      return;
    }

    const gameName = String(body.gameName || "").trim();
    const tagLine = String(body.tagLine || "").trim();
    const platformRegion = String(body.platformRegion || "KR").trim().toUpperCase();
    const matchCount = Math.min(Math.max(Number(body.matchCount || 10), 1), 20);
    const start = Math.max(0, Number(body.start || 0));

    if (!gameName || !tagLine) {
      sendJson(res, 400, { ok: false, error: "gameName and tagLine are required." });
      return;
    }
    const riotIdError = validateRiotId(gameName, tagLine);
    if (riotIdError) {
      sendJson(res, 400, { ok: false, error: riotIdError });
      return;
    }

    const cluster = regionalCluster(platformRegion);
    const headers = {
      "X-Riot-Token": apiKey,
      "User-Agent": "codex-local-sample-server",
      Accept: "application/json",
    };

    const account = await requestJson(
      `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      headers,
    );

    // summoner + league + matchIds + mastery 병렬 호출
    // league-v4/by-puuid: Riot이 summoner-v4 id 응답 제거 이후의 신규 엔드포인트
    const platformHost = `${platformRegion.toLowerCase()}.api.riotgames.com`;
    let rankedLookupError = null;
    const [matchIds, summonerData, leagueEntries, masteryData] = await Promise.all([
      requestJson(
        `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(account.puuid)}/ids?start=${start}&count=${matchCount}`,
        headers,
      ),
      requestJson(
        `https://${platformHost}/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(account.puuid)}`,
        headers,
      ).catch(() => null),
      requestJson(
        `https://${platformHost}/lol/league/v4/entries/by-puuid/${encodeURIComponent(account.puuid)}`,
        headers,
      ).catch((error) => {
        rankedLookupError = error;
        return null;
      }),
      requestJson(
        `https://${platformHost}/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(account.puuid)}/top?count=20`,
        headers,
      ).catch(() => null),
    ]);

    let ranked = null;
    let rankedStatus = "unranked";
    let rankedError = null;
    if (Array.isArray(leagueEntries)) {
      const rankedEntry = selectRankedEntry(leagueEntries);
      if (rankedEntry) {
        ranked = buildRankedSnapshot(rankedEntry);
        rankedStatus = "ok";
      }
    } else if (rankedLookupError) {
      rankedStatus = "error";
      rankedError = rankedLookupErrorMessage();
    }


    const details = await Promise.all(
      matchIds.map((matchId) =>
        requestJson(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`, headers),
      ),
    );

    const matches = details
      .map((detail) => summarizeMatch(detail, account.puuid))
      .filter(Boolean)
      .sort((a, b) => b.timestamp - a.timestamp);

    sendJson(res, 200, {
      ok: true,
      riotId: `${account.gameName}#${account.tagLine}`,
      publicAlias: body.publicAlias || `${account.gameName}#${account.tagLine}`,
      puuid: account.puuid,
      platformRegion,
      matchCount,
      start,
      hasMore: Array.isArray(matchIds) && matchIds.length >= matchCount,
      summonerLevel: summonerData?.summonerLevel || null,
      profileIconId: summonerData?.profileIconId || null,
      ranked,
      rankedStatus,
      rankedError,
      championMastery: masteryData || [],
      matches,
    });
  } catch (error) {
    const { status, body } = riotErrorPayload(error);
    sendJson(res, status, body);
  }
}

async function handleChampionHistory(req, res) {
  const ip = getClientIp(req);
  if (!rateLimit(`championHistory:${ip}`, 60000)) {
    sendJson(res, 429, { ok: false, error: "60초 후 다시 시도해주세요." });
    return;
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (error) {
    const { status, body: errorBody } = riotErrorPayload(error);
    sendJson(res, status, errorBody);
    return;
  }

  const apiKey = resolveApiKey(body.riotApiKey);
  if (!apiKey) {
    sendJson(res, 500, { ok: false, error: "Riot API Key가 없습니다." });
    return;
  }

  const gameName = String(body.gameName || "").trim();
  const tagLine = String(body.tagLine || "").trim();
  const platformRegion = String(body.platformRegion || "KR").trim().toUpperCase();
  if (!gameName || !tagLine) {
    sendJson(res, 400, { ok: false, error: "gameName and tagLine are required." });
    return;
  }
  const riotIdError = validateRiotId(gameName, tagLine);
  if (riotIdError) {
    sendJson(res, 400, { ok: false, error: riotIdError });
    return;
  }

  const cluster = regionalCluster(platformRegion);
  const headers = {
    "X-Riot-Token": apiKey,
    "User-Agent": "codex-local-sample-server",
    Accept: "application/json",
  };

  writeSseHeaders(res);
  let aborted = false;
  req.on("close", () => { aborted = true; });

  const safeWrite = (event, data) => {
    if (res.writableEnded || res.destroyed) return;
    try { writeSseEvent(res, event, data); } catch {}
  };
  const safeEnd = () => {
    if (res.writableEnded || res.destroyed) return;
    try { res.end(); } catch {}
  };

  try {
    const account = await requestJson(
      `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      headers,
    );
    if (aborted) { safeEnd(); return; }
    safeWrite("progress", { phase: "account" });

    const queueIds = [420, 440];
    const allIds = [];
    for (const queueId of queueIds) {
      if (aborted) { safeEnd(); return; }
      const ids = await getCurrentSeasonRankedMatchIds(cluster, headers, account.puuid, queueId, (info) => {
        safeWrite("progress", { phase: "ids", queueId, fetched: info.fetched });
      });
      allIds.push(...ids);
    }
    const uniqueIds = Array.from(new Set(allIds));
    safeWrite("progress", { phase: "ids-done", total: uniqueIds.length });

    const matches = [];
    for (let i = 0; i < uniqueIds.length; i += 1) {
      if (aborted) { safeEnd(); return; }
      const id = uniqueIds[i];
      try {
        const match = await requestJson(
          `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(id)}`,
          headers,
        );
        const summary = summarizeMatch(match, account.puuid);
        if (summary && (summary.queueId === 420 || summary.queueId === 440)) {
          matches.push(summary);
        }
      } catch (error) {
        // 개별 매치 실패는 부분 누락으로 처리, 전체 중단하지 않음
        safeWrite("progress", { phase: "match-error", matchId: id, message: championHistoryMatchErrorMessage() });
      }
      safeWrite("progress", { phase: "details", current: i + 1, total: uniqueIds.length });
      if (i < uniqueIds.length - 1) {
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 1200);
          req.once("close", () => { clearTimeout(timer); resolve(); });
        });
      }
    }

    safeWrite("done", {
      matches,
      totalGames: matches.length,
      fetchedAt: new Date().toISOString(),
    });
    safeEnd();
  } catch (error) {
    const { body } = riotErrorPayload(error);
    safeWrite("error", body.code
      ? { code: body.code, error: body.error, hint: body.hint }
      : { error: body.error });
    safeEnd();
  }
}

let manifestMutationQueue = Promise.resolve();

function withManifestMutationLock(work) {
  const run = manifestMutationQueue.catch(() => {}).then(work);
  manifestMutationQueue = run.catch(() => {});
  return run;
}

function isManifestFileLockStale(lockStats, nowMs = Date.now()) {
  return Number.isFinite(lockStats?.mtimeMs) &&
    nowMs - lockStats.mtimeMs >= MANIFEST_FILE_LOCK_STALE_MS;
}

async function tryRemoveStaleManifestFileLock() {
  let lockStats = null;
  try {
    lockStats = await fsp.stat(manifestFileLockPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return true;
    }
    throw error;
  }

  if (!isManifestFileLockStale(lockStats)) {
    return false;
  }

  try {
    await fsp.rmdir(manifestFileLockPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return true;
    }
    throw error;
  }
}

async function acquireManifestFileLock() {
  const startedAt = Date.now();

  while (true) {
    try {
      await fsp.mkdir(manifestFileLockPath);
      return;
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }
      const removedStaleLock = await tryRemoveStaleManifestFileLock();
      if (removedStaleLock) {
        continue;
      }
      if (Date.now() - startedAt >= MANIFEST_FILE_LOCK_TIMEOUT_MS) {
        const timeoutError = new Error("Timed out waiting for manifest file lock.");
        timeoutError.code = "MANIFEST_FILE_LOCK_TIMEOUT";
        throw timeoutError;
      }
      await sleep(MANIFEST_FILE_LOCK_RETRY_MS);
    }
  }
}

async function releaseManifestFileLock() {
  try {
    await fsp.rmdir(manifestFileLockPath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

async function withManifestFileLock(work) {
  await acquireManifestFileLock();
  try {
    return await work();
  } finally {
    await releaseManifestFileLock();
  }
}

async function upsertManifestEntry(entry) {
  return withManifestMutationLock(() => withManifestFileLock(async () => {
    const manifest = await loadManifest();
    const nextSamples = manifest.samples.filter((sample) => sample.id !== entry.id);
    nextSamples.unshift(entry);
    manifest.samples = nextSamples;
    await saveManifest(manifest);
    return manifest;
  }));
}

function inferMatchIdFromSampleEntry(entry) {
  if (!entry) return null;
  if (entry.matchId) return entry.matchId;

  const sources = [entry.id, entry.label, entry.normalizedPath, entry.analysisPath, entry.notesPath];
  for (const source of sources) {
    if (typeof source !== "string") continue;
    const match = source.match(/([a-z0-9]+)[-_](\d{8,})/i);
    if (match) {
      return `${match[1].toUpperCase()}_${match[2]}`;
    }
  }

  return null;
}

function publicSampleListEntry(sample) {
  const { matchId, ...publicSample } = sample || {};
  return publicSample;
}

const sampleGenerationLocks = new Map();

function sampleGenerationLockKey(input) {
  const { platformRegion, matchId } = input || {};
  const region = String(platformRegion || "").trim().toUpperCase() || "UNKNOWN";
  const normalizedMatchId = String(matchId || "").trim().toUpperCase() || "UNKNOWN";
  return `${region}:${normalizedMatchId}`;
}

function sampleGenerationInProgressPayload() {
  return {
    ok: false,
    code: "SAMPLE_GENERATION_IN_PROGRESS",
    error: "이미 이 경기 샘플 생성이 진행 중입니다. 완료 후 샘플 목록을 확인하세요.",
  };
}

function sampleGenerationHealth(nowMs = Date.now()) {
  let oldestStartedAt = null;
  for (const startedAt of sampleGenerationLocks.values()) {
    if (!Number.isFinite(startedAt)) continue;
    if (oldestStartedAt === null || startedAt < oldestStartedAt) {
      oldestStartedAt = startedAt;
    }
  }
  return {
    activeCount: sampleGenerationLocks.size,
    oldestAgeMs: oldestStartedAt === null ? 0 : Math.floor(Math.max(0, nowMs - oldestStartedAt)),
  };
}

function withSampleGenerationLock(lockKey, work) {
  if (sampleGenerationLocks.has(lockKey)) {
    const error = new Error("SAMPLE_GENERATION_IN_PROGRESS");
    error.statusCode = 409;
    error.payload = sampleGenerationInProgressPayload();
    throw error;
  }

  sampleGenerationLocks.set(lockKey, Date.now());
  return Promise.resolve()
    .then(work)
    .finally(() => {
      sampleGenerationLocks.delete(lockKey);
    });
}

async function runGenerateSampleJob(req, res, { body, apiKey, gameName, tagLine, platformRegion, matchId }) {
  const ip = getClientIp(req);
  if (!rateLimit(`generate:${ip}`, 60000)) {
    sendJson(res, 429, { ok: false, error: "샘플 생성은 1분에 1회만 가능합니다." });
    return;
  }

  const cluster = regionalCluster(platformRegion);
  const headers = {
    "X-Riot-Token": apiKey,
    "User-Agent": "codex-local-sample-server",
    Accept: "application/json",
  };

  const account = await requestJson(
    `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    headers,
  );
  const matchDetail = await requestJson(
    `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
    headers,
  );
  const timeline = await requestJson(
    `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`,
    headers,
  );

  const sampleId = `sample-${matchId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const sampleDir = sampleStoragePath(sampleId);
  await fsp.mkdir(sampleDir, { recursive: true });

  const publicAlias =
    body.publicAlias || (account.gameName && account.tagLine ? `${account.gameName}#${account.tagLine}` : `PlayerAlias#${tagLine}`);
  const normalized = buildNormalized(account, matchDetail, timeline, {
    platformRegion,
    cluster,
    publicAlias,
  });
  const analysis = await buildAnalysis(normalized, sampleId);

  // __comparison은 임시 전달 필드 — 저장 전 분리
  const comparison = analysis.__comparison ?? null;
  delete analysis.__comparison;

  await Promise.all([
    writeJson(path.join(sampleDir, "raw-account.json"), account),
    writeJson(path.join(sampleDir, "raw-match.json"), matchDetail),
    writeJson(path.join(sampleDir, "raw-timeline.json"), timeline),
    writeJson(path.join(sampleDir, "normalized-match.json"), normalized),
    writeJson(path.join(sampleDir, "analysis-result.json"), analysis),
    comparison
      ? writeJson(path.join(sampleDir, "comparison-result.json"), comparison)
      : Promise.resolve(),
    fsp.writeFile(
      path.join(sampleDir, `${sampleId}-notes.md`),
      `# ${sampleId} notes\n\n- Match ID: \`${matchId}\`\n- Riot ID source: \`${gameName}#${tagLine}\`\n- Public alias: \`${publicAlias}\`\n- Theme: ${analysis.matchSummary.headline}\n`,
      "utf8",
    ),
  ]);

  const entry = {
    id: sampleId,
    matchId,
    label: `${sampleId} · ${normalized.matchInfo.position} ${normalized.matchInfo.result}`,
    champion: normalized.matchInfo.champion,
    publicAlias,
    collectedDate: new Date().toISOString().slice(0, 10),
    theme: analysis.matchSummary?.headline || analysis.coachSummary?.gameFlowSummary || "",
    normalizedPath: `/data/samples/${sampleId}/normalized-match.json`,
    analysisPath: `/data/samples/${sampleId}/analysis-result.json`,
    notesPath: `/data/samples/${sampleId}/${sampleId}-notes.md`,
  };

  await upsertManifestEntry(entry);

  sendJson(res, 200, {
    ok: true,
    sampleId,
    publicAlias,
    collectedDate: entry.collectedDate,
    theme: entry.theme,
    normalized,
    analysis,
  });
}

async function handleGenerateSample(req, res) {
  try {
    const body = await parseBody(req);
    const apiKey = resolveApiKey(body.riotApiKey);
    if (!apiKey) {
      sendJson(res, 500, { ok: false, error: "Riot API Key가 없습니다. 로그인 화면에서 키를 입력하거나 서버 .env를 확인하세요." });
      return;
    }

    const gameName = String(body.gameName || "").trim();
    const tagLine = String(body.tagLine || "").trim();
    const platformRegion = String(body.platformRegion || "KR").trim().toUpperCase();
    const matchId = String(body.matchId || "").trim();

    if (!gameName || !tagLine || !matchId) {
      sendJson(res, 400, { ok: false, error: "gameName, tagLine, and matchId are required." });
      return;
    }
    const riotIdError = validateRiotId(gameName, tagLine);
    if (riotIdError) {
      sendJson(res, 400, { ok: false, error: riotIdError });
      return;
    }

    const lockKey = sampleGenerationLockKey({ platformRegion, matchId });
    await withSampleGenerationLock(lockKey, () => runGenerateSampleJob(req, res, {
      body,
      apiKey,
      gameName,
      tagLine,
      platformRegion,
      matchId,
    }));
  } catch (error) {
    if (error?.payload?.code === "SAMPLE_GENERATION_IN_PROGRESS") {
      sendJson(res, 409, error.payload);
      return;
    }
    const { status, body } = riotErrorPayload(error);
    sendJson(res, status, body);
  }
}

function invalidSampleIdPayload() {
  return {
    ok: false,
    code: "INVALID_SAMPLE_ID",
    error: "샘플 ID가 올바르지 않습니다.",
  };
}

function sampleDetailIdFromPathname(pathname) {
  const pathValue = String(pathname || "");
  if (!pathValue.startsWith(SAMPLE_DETAIL_PATH_PREFIX)) {
    return null;
  }
  const sampleId = pathValue.slice(SAMPLE_DETAIL_PATH_PREFIX.length);
  if (!isValidSampleId(sampleId)) {
    return null;
  }
  return sampleId;
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/healthz") {
    sendJson(res, 200, {
      ok: true,
      service: "lol-replay-coach",
      ...publicDemoModeHealth(),
      sampleGeneration: sampleGenerationHealth(),
      timestamp: new Date().toISOString(),
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/samples") {
    const manifest = await loadManifest();
    sendJson(res, 200, {
      ...manifest,
      samples: manifest.samples.map(publicSampleListEntry),
    });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith(SAMPLE_DETAIL_PATH_PREFIX)) {
    const sampleId = sampleDetailIdFromPathname(url.pathname);
    if (!sampleId) {
      sendJson(res, 400, invalidSampleIdPayload());
      return true;
    }
    const bundle = await loadSampleBundle(sampleId);
    if (!bundle) {
      sendJson(res, 404, { ok: false, error: "Sample not found." });
      return true;
    }
    sendJson(res, 200, bundle);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/recent-matches") {
    if (!requireLiveApiAccess(req, res)) {
      return true;
    }
    await handleRecentMatches(req, res);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/champion-history") {
    if (!requireLiveApiAccess(req, res)) {
      return true;
    }
    await handleChampionHistory(req, res);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/generate-sample") {
    if (!requireLiveApiAccess(req, res)) {
      return true;
    }
    await handleGenerateSample(req, res);
    return true;
  }

  return false;
}

function decodeUrlPath(urlPath) {
  try {
    return decodeURIComponent(urlPath);
  } catch {
    return "";
  }
}

function isAllowedStaticPath(urlPath) {
  const decoded = decodeUrlPath(urlPath);
  if (!decoded || decoded.includes("\0")) return false;
  if (!decoded.startsWith("/")) return false;
  if (decoded.includes("..")) return false;

  if (publicStaticPaths.has(decoded)) {
    return true;
  }

  if (blockedStaticPrefixes.some((prefix) => decoded === prefix.slice(0, -1) || decoded.startsWith(prefix))) {
    return false;
  }

  if (blockedStaticSuffixes.some((suffix) => decoded.toLowerCase().endsWith(suffix))) {
    return false;
  }

  return false;
}

function staticFilePath(urlPath) {
  if (!isAllowedStaticPath(urlPath)) {
    return null;
  }

  const decoded = decodeUrlPath(urlPath);
  const requested = decoded === "/" ? "/index.html" : decoded;
  const filePath = path.normalize(path.join(root, requested));
  if (!filePath.startsWith(root)) {
    return null;
  }
  return filePath;
}

async function handleStatic(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  const filePath = staticFilePath(url.pathname);
  if (!filePath) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const stat = await fsp.stat(filePath);
    const finalPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const ext = path.extname(finalPath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    const headers = {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    };
    if (req.method === "HEAD") {
      res.writeHead(200, headers);
      res.end();
      return;
    }
    const stream = fs.createReadStream(finalPath);
    res.writeHead(200, headers);
    stream.pipe(res);
  } catch (error) {
    sendText(res, 404, "Not found");
  }
}

function invalidRequestTargetError() {
  const error = new Error("요청 URL이 올바르지 않습니다.");
  error.statusCode = 400;
  error.payload = {
    ok: false,
    code: "INVALID_REQUEST_TARGET",
    error: "요청 URL이 올바르지 않습니다.",
  };
  return error;
}

function internalServerErrorPayload() {
  return {
    ok: false,
    code: "INTERNAL_SERVER_ERROR",
    error: "서버 처리 중 오류가 발생했습니다.",
  };
}

function requestUrlFrom(req) {
  const rawTarget = firstHeaderValue(req.url) || "/";
  if (!rawTarget.startsWith("/") || rawTarget.startsWith("//")) {
    throw invalidRequestTargetError();
  }
  const host = firstHeaderValue(req.headers.host) || "127.0.0.1";
  try {
    return new URL(rawTarget, `http://${host}`);
  } catch {
    throw invalidRequestTargetError();
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = requestUrlFrom(req);
    const handled = await handleApi(req, res, url);
    if (handled) {
      return;
    }
    await handleStatic(req, res, url);
  } catch (error) {
    sendJson(res, error?.statusCode || 500, error?.payload || internalServerErrorPayload(error));
  }
});

server.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});
