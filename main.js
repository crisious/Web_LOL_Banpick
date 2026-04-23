const dom = {
  heroPlayer: document.querySelector("[data-hero-player]"),
  heroDate: document.querySelector("[data-hero-date]"),
  headline: document.querySelector("[data-headline]"),
  resultPill: document.querySelector("[data-result-pill]"),
  snapshotChampion: document.querySelector("[data-snapshot-champion]"),
  snapshotChampionIcon: document.querySelector("[data-snapshot-champion-icon]"),
  snapshotRole: document.querySelector("[data-snapshot-role]"),
  snapshotQueue: document.querySelector("[data-snapshot-queue]"),
  snapshotDuration: document.querySelector("[data-snapshot-duration]"),
  snapshotPatch: document.querySelector("[data-snapshot-patch]"),
  snapshotMastery: document.querySelector("[data-snapshot-mastery]"),
  snapshotMasteryText: document.querySelector("[data-snapshot-mastery-text]"),
  detailHeader: document.querySelector("[data-detail-header]"),
  quickSummary: document.querySelector("[data-quick-summary]"),
  snapshotCsPerMin: document.querySelector("[data-snapshot-cs-per-min]"),
  statRibbon: document.querySelector("[data-stat-ribbon]"),
  phaseGrid: document.querySelector("[data-phase-grid]"),
  strengths: document.querySelector("[data-strengths]"),
  weaknesses: document.querySelector("[data-weaknesses]"),
  checklist: document.querySelector("[data-checklist]"),
  keyMoments: document.querySelector("[data-key-moments]"),
  evidence: document.querySelector("[data-evidence]"),
  sampleSwitcher: document.querySelector("[data-sample-switcher]"),
  reportStrip: document.querySelector("[data-report-strip]"),
  trendHeadline: document.querySelector("[data-trend-headline]"),
  trendSummary: document.querySelector("[data-trend-summary]"),
  trendStats: document.querySelector("[data-trend-stats]"),
  trendTags: document.querySelector("[data-trend-tags]"),
  trendStrengths: document.querySelector("[data-trend-strengths]"),
  trendWeaknesses: document.querySelector("[data-trend-weaknesses]"),
  recentForm: document.querySelector("[data-recent-form]"),
  fetchStatus: document.querySelector("[data-fetch-status]"),
  candidateList: document.querySelector("[data-candidate-list]"),
  comparisonStatus: document.querySelector("[data-comparison-status]"),
  comparisonOverview: document.querySelector("[data-comparison-overview]"),
  comparisonGrid: document.querySelector("[data-comparison-grid]"),
  loginOverlay: document.querySelector("[data-login-overlay]"),
  loginForm: document.querySelector("[data-login-form]"),
  loginStatus: document.querySelector("[data-login-status]"),
  matchListView: document.querySelector("[data-match-list-view]"),
  matchListGrid: document.querySelector("[data-match-list-grid]"),
  matchListHeader: document.querySelector("[data-match-list-header]"),
  matchListFooter: document.querySelector("[data-match-list-footer]"),
  backToListBtn: document.querySelector("[data-back-to-list]"),
  scorePanel: document.querySelector("[data-score-panel]"),
  objectiveSummary: document.querySelector("[data-objective-summary]"),
  objectiveTable: document.querySelector("[data-objective-table]"),
  kdaChart: document.querySelector("[data-kda-chart]"),
  kdaEvents: document.querySelector("[data-kda-events]"),
  laningStats: document.querySelector("[data-laning-stats]"),
  wardSummary: document.querySelector("[data-ward-summary]"),
  wardEvents: document.querySelector("[data-ward-events]"),
  buildTimeline: document.querySelector("[data-build-timeline]"),
  tabBar: document.querySelector("[data-tab-bar]"),
  dualTimeline: document.querySelector("[data-dual-timeline]"),
  dualDetail: document.querySelector("[data-dual-detail]"),
  detailProgress: document.querySelector("[data-detail-progress]"),
  detailProgressTitle: document.querySelector("[data-detail-progress-title]"),
  detailProgressPercent: document.querySelector("[data-detail-progress-percent]"),
  detailProgressBar: document.querySelector("[data-detail-progress-bar]"),
  detailProgressSteps: document.querySelector("[data-detail-progress-steps]"),
  detailProgressMessage: document.querySelector("[data-detail-progress-message]"),
};

const state = {
  manifest: [],
  currentSample: null,
  currentSampleId: null,
  view: "LOGGED_OUT",
  account: null,
  recentMatches: [],
  recentMatchesHasMore: false,
  isLoadMorePending: false,
  prefetchedSamples: new Map(),
  riotApiKey: "",
  detailProgress: {
    status: "idle",
    stepId: "",
    message: "",
    progress: 0,
    soft: false,
    skippedSteps: [],
  },
  detailProgressTimer: null,
};

const REPORT_STRIP_LIMIT = 6;

const HTML_ESCAPE = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"'`]/g, (char) => HTML_ESCAPE[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}

// ─── localStorage persistence ─────────────────────────────────────────────

function saveAccount(account) {
  localStorage.setItem("lol-coach-account", JSON.stringify(account));
}

function loadSavedAccount() {
  try { return JSON.parse(localStorage.getItem("lol-coach-account")); } catch { return null; }
}

function saveApiKey(key) {
  if (key) localStorage.setItem("lol-coach-api-key", key);
  else localStorage.removeItem("lol-coach-api-key");
}

function loadSavedApiKey() {
  return localStorage.getItem("lol-coach-api-key") || "";
}

function getUserApiKey() {
  return state.riotApiKey || "";
}

// ─── View state machine ──────────────────────────────────────────────────

function setView(viewName) {
  state.view = viewName;
  document.body.dataset.view = viewName;
}

const DETAIL_PROGRESS_STEPS = [
  { id: "prepare", label: "분석 준비" },
  { id: "lookup", label: "저장된 분석 확인" },
  { id: "riot", label: "Riot 데이터 확인" },
  { id: "ai", label: "AI 분석 생성 중" },
  { id: "compose", label: "리포트 구성" },
  { id: "complete", label: "완료" },
];

function detailProgressBaseValue(stepId) {
  const values = {
    prepare: 8,
    lookup: 24,
    riot: 42,
    ai: 64,
    compose: 88,
    complete: 100,
  };
  return values[stepId] ?? 0;
}

function stopDetailProgressTimer() {
  if (state.detailProgressTimer) {
    clearInterval(state.detailProgressTimer);
    state.detailProgressTimer = null;
  }
}

function renderDetailProgress() {
  if (!dom.detailProgress) return;

  const progressState = state.detailProgress;
  const isIdle = progressState.status === "idle";
  dom.detailProgress.hidden = isIdle;
  dom.detailProgress.dataset.status = progressState.status;
  dom.detailProgress.classList.toggle("detail-progress--soft", Boolean(progressState.soft));
  dom.detailProgress.setAttribute("aria-busy", progressState.status === "running" ? "true" : "false");

  if (isIdle) {
    if (dom.detailProgressSteps) dom.detailProgressSteps.innerHTML = "";
    if (dom.detailProgressMessage) dom.detailProgressMessage.textContent = "";
    return;
  }

  const progress = Math.max(0, Math.min(100, Math.round(progressState.progress || 0)));
  const activeIndex = DETAIL_PROGRESS_STEPS.findIndex((step) => step.id === progressState.stepId);
  const skipped = new Set(progressState.skippedSteps || []);
  const titleByStatus = {
    running: "상세 분석 진행 중",
    complete: "상세 분석 완료",
    error: "상세 분석 실패",
  };

  if (dom.detailProgressTitle) {
    dom.detailProgressTitle.textContent = titleByStatus[progressState.status] || "상세 분석 진행 중";
  }
  if (dom.detailProgressPercent) {
    dom.detailProgressPercent.textContent = `${progress}%`;
  }
  if (dom.detailProgressBar) {
    dom.detailProgressBar.style.width = `${progress}%`;
  }
  if (dom.detailProgressMessage) {
    dom.detailProgressMessage.textContent = progressState.message || "";
  }
  if (dom.detailProgressSteps) {
    dom.detailProgressSteps.innerHTML = DETAIL_PROGRESS_STEPS.map((step, index) => {
      let stepState = "waiting";
      if (skipped.has(step.id)) {
        stepState = "skipped";
      } else if (progressState.status === "complete") {
        stepState = "done";
      } else if (index < activeIndex) {
        stepState = "done";
      } else if (index === activeIndex) {
        stepState = progressState.status === "error" ? "error" : "running";
      }

      return `
        <li class="detail-progress__step" data-step-state="${stepState}">
          <span class="detail-progress__dot" aria-hidden="true"></span>
          <strong>${escapeHtml(step.label)}</strong>
        </li>
      `;
    }).join("");
  }
}

function updateDetailProgress(stepId, options = {}) {
  const progress = options.progress ?? detailProgressBaseValue(stepId);
  state.detailProgress = {
    status: options.status || "running",
    stepId,
    message: options.message || "",
    progress,
    soft: Boolean(options.soft),
    skippedSteps: options.skippedSteps || state.detailProgress.skippedSteps || [],
  };
  renderDetailProgress();
}

function setDetailProgress(stepId, options = {}) {
  stopDetailProgressTimer();
  updateDetailProgress(stepId, options);
}

function startSoftDetailProgress(stepId, message, options = {}) {
  stopDetailProgressTimer();
  const start = Math.max(state.detailProgress.progress || 0, options.progress ?? detailProgressBaseValue(stepId));
  updateDetailProgress(stepId, {
    ...options,
    message,
    progress: start,
    soft: true,
  });

  state.detailProgressTimer = setInterval(() => {
    const current = state.detailProgress.progress || start;
    const next = Math.min(88, current + (current < 74 ? 4 : 2));
    updateDetailProgress(stepId, {
      ...options,
      message,
      progress: next,
      soft: true,
    });
  }, 1800);
}

function resetDetailProgress() {
  stopDetailProgressTimer();
  state.detailProgress = {
    status: "idle",
    stepId: "",
    message: "",
    progress: 0,
    soft: false,
    skippedSteps: [],
  };
  renderDetailProgress();
}

function completeDetailProgress(message = "리포트를 열었습니다.") {
  stopDetailProgressTimer();
  updateDetailProgress("complete", {
    status: "complete",
    message,
    progress: 100,
  });
  setTimeout(() => {
    if (state.detailProgress.status === "complete") {
      resetDetailProgress();
    }
  }, 900);
}

function failDetailProgress(message = "상세 분석을 열지 못했습니다.") {
  stopDetailProgressTimer();
  updateDetailProgress(state.detailProgress.stepId || "prepare", {
    status: "error",
    message,
    progress: state.detailProgress.progress || 100,
    skippedSteps: state.detailProgress.skippedSteps || [],
  });
  setTimeout(() => {
    if (state.detailProgress.status === "error") {
      resetDetailProgress();
    }
  }, 1400);
}

// ─── Time helpers ────────────────────────────────────────────────────────

function timeAgo(epochMs) {
  const diff = Date.now() - epochMs;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "방금 전";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return `${Math.floor(day / 30)}개월 전`;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function ratingLabel(rating) {
  if (rating === "GOOD") return "좋음";
  if (rating === "BAD") return "아쉬움";
  return "보통";
}

function resultLabel(result) {
  return result === "WIN" ? "승리" : "패배";
}

function compactQueueLabel(queueLabel) {
  const map = {
    RANKED_SOLO: "솔랭",
    RANKED_FLEX: "자랭",
    NORMAL_BLIND: "일반",
    ARAM: "칼바람",
  };

  return map[queueLabel] || queueLabel;
}

function compactPatchLabel(version) {
  const text = String(version || "");
  const parts = text.split(".");
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[1]}`;
  }
  return text;
}

function matchPatchLabel(version) {
  const patch = compactPatchLabel(version);
  return patch ? `패치 ${patch}` : "패치 -";
}

const TIER_LABELS = {
  IRON: "아이언",
  BRONZE: "브론즈",
  SILVER: "실버",
  GOLD: "골드",
  PLATINUM: "플래티넘",
  EMERALD: "에메랄드",
  DIAMOND: "다이아몬드",
  MASTER: "마스터",
  GRANDMASTER: "그랜드마스터",
  CHALLENGER: "챌린저",
};

const RANKED_QUEUE_LABELS = {
  RANKED_SOLO_5x5: "솔로랭크",
  RANKED_FLEX_SR: "자유랭크",
};

function normalizeRankedSnapshot(ranked) {
  if (!ranked || typeof ranked !== "object") return null;
  const tier = String(ranked.tier || "").trim().toUpperCase();
  if (!tier) return null;
  const rank = String(ranked.rank || "").trim().toUpperCase();
  const queueType = String(ranked.queueType || "RANKED_SOLO_5x5").trim();

  return {
    ...ranked,
    queueType,
    queueLabel: ranked.queueLabel || RANKED_QUEUE_LABELS[queueType] || "랭크",
    tier,
    tierLabel: TIER_LABELS[tier] || tier,
    rank,
    lp: Number.isFinite(Number(ranked.lp)) ? Number(ranked.lp) : 0,
    wins: Number.isFinite(Number(ranked.wins)) ? Number(ranked.wins) : 0,
    losses: Number.isFinite(Number(ranked.losses)) ? Number(ranked.losses) : 0,
    winRate: Number.isFinite(Number(ranked.winRate)) ? Number(ranked.winRate) : 0,
  };
}

function rankedDivisionLabel(ranked) {
  if (!ranked?.rank || ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(ranked.tier)) {
    return "";
  }
  return ranked.rank;
}

function rankedDisplayName(ranked) {
  return [ranked?.tierLabel, rankedDivisionLabel(ranked)].filter(Boolean).join(" ") || "랭크";
}

function rankedEmblemLabel(ranked) {
  const label = ranked?.tierLabel || ranked?.tier || "?";
  return label.slice(0, 1).toUpperCase();
}

function championDisplayName(name) {
  return String(name || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
}

const CHAMPION_ART_ALIASES = {
  FiddleSticks: "Fiddlesticks",
  Wukong: "MonkeyKing",
};

let championCdnVersion = "";
let championCdnVersionPromise = null;
let championAssetMap = null;
let championAssetMapPromise = null;
let championIdToName = new Map(); // numeric championId → champion asset key

function normalizeChampionToken(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function registerChampionAssetKey(map, candidate, assetKey) {
  const token = normalizeChampionToken(candidate);
  if (!token) return;
  map.set(token, assetKey);
}

function championAssetKey(name) {
  const raw = String(name || "").trim();
  if (!raw) return "";
  const normalized = normalizeChampionToken(raw);
  if (championAssetMap?.has(normalized)) {
    return championAssetMap.get(normalized) || raw;
  }
  return CHAMPION_ART_ALIASES[raw] || raw;
}

function championArtUrl(name) {
  const key = championAssetKey(name);
  if (!key) return "";
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${key}_0.jpg`;
}

function championSquareUrl(name) {
  const key = championAssetKey(name);
  if (!key || !championCdnVersion) return "";
  return `https://ddragon.leagueoflegends.com/cdn/${championCdnVersion}/img/champion/${key}.png`;
}

function championAvatarArtValue(name, size = "medium") {
  const artUrl = championArtUrl(name);

  if (size === "large") {
    return artUrl ? `url('${artUrl}')` : "";
  }

  const squareUrl = championSquareUrl(name);
  if (squareUrl) {
    return `url('${squareUrl}')`;
  }

  return artUrl ? `url('${artUrl}')` : "";
}

function championAvatarPosition(name, size = "medium") {
  if (size === "large") {
    return "center top";
  }
  return championSquareUrl(name) ? "center center" : "center top";
}

function inferChampionAvatarSize(node) {
  if (node?.classList.contains("champion-avatar--large")) return "large";
  if (node?.classList.contains("champion-avatar--small")) return "small";
  return "medium";
}

function applyChampionAvatarPresentation(node, name) {
  if (!node) return;

  const size = inferChampionAvatarSize(node);
  const artValue = championAvatarArtValue(name, size);
  if (artValue) {
    node.style.setProperty("--champion-art", artValue);
    node.style.setProperty("--champion-art-position", championAvatarPosition(name, size));
  } else {
    node.style.removeProperty("--champion-art");
    node.style.removeProperty("--champion-art-position");
  }
}

function refreshChampionAvatarElements() {
  document.querySelectorAll(".champion-avatar[data-champion-name]").forEach((node) => {
    applyChampionAvatarPresentation(node, node.dataset.championName);
  });
}

function loadChampionAssetMap(version) {
  if (!version || championAssetMap || championAssetMapPromise) return;

  championAssetMapPromise = fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`)
    .then((response) => (response.ok ? response.json() : null))
    .then((payload) => {
      if (!payload?.data) return;

      const nextMap = new Map();
      const nextIdMap = new Map();
      Object.values(payload.data).forEach((champion) => {
        registerChampionAssetKey(nextMap, champion.id, champion.id);
        registerChampionAssetKey(nextMap, champion.name, champion.id);
        registerChampionAssetKey(nextMap, championDisplayName(champion.id), champion.id);
        if (champion.key) nextIdMap.set(Number(champion.key), champion.id);
      });

      Object.entries(CHAMPION_ART_ALIASES).forEach(([alias, assetKey]) => {
        registerChampionAssetKey(nextMap, alias, assetKey);
      });

      championAssetMap = nextMap;
      championIdToName = nextIdMap;
      refreshChampionAvatarElements();
      refreshMasteryDisplay();
    })
    .catch((err) => console.warn("[CDN] Champion asset map load failed:", err.message))
    .finally(() => {
      championAssetMapPromise = null;
    });
}

function queueChampionVersionLoad() {
  if (championCdnVersion) {
    loadChampionAssetMap(championCdnVersion);
    return;
  }

  if (championCdnVersionPromise) return;

  championCdnVersionPromise = fetch("https://ddragon.leagueoflegends.com/api/versions.json")
    .then((response) => (response.ok ? response.json() : []))
    .then((versions) => {
      if (Array.isArray(versions) && versions[0]) {
        championCdnVersion = versions[0];
        loadChampionAssetMap(championCdnVersion);
        refreshChampionAvatarElements();
      }
    })
    .catch((err) => console.warn("[CDN] Champion version fetch failed:", err.message))
    .finally(() => {
      championCdnVersionPromise = null;
    });
}

function profileIconUrl(iconId) {
  if (!iconId || !championCdnVersion) return "";
  return `https://ddragon.leagueoflegends.com/cdn/${championCdnVersion}/img/profileicon/${iconId}.png`;
}

function championNameFromId(numericId) {
  return championIdToName.get(Number(numericId)) || "";
}

function findMasteryForChampion(championName) {
  const mastery = state.account?.championMastery;
  if (!Array.isArray(mastery) || mastery.length === 0) return null;
  const assetKey = championAssetKey(championName);
  return mastery.find((m) => championNameFromId(m.championId) === assetKey) || null;
}

function formatMasteryPoints(pts) {
  if (!pts) return "0";
  if (pts >= 1000000) return `${(pts / 1000000).toFixed(1)}M`;
  if (pts >= 1000) return `${(pts / 1000).toFixed(1)}K`;
  return String(pts);
}

function refreshMasteryDisplay() {
  if (state.view === "MATCH_LIST" && state.recentMatches.length > 0) {
    renderMatchList();
  }
}

function championMonogram(name) {
  const display = championDisplayName(name);
  const parts = display.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return (parts[0] || "??").slice(0, 2).toUpperCase();
}

function championAvatarMarkup(name, size = "medium") {
  const display = championDisplayName(name) || "Unknown";
  const monogram = championMonogram(name);
  const artValue = championAvatarArtValue(name, size);
  const artStyle = artValue
    ? ` style="--champion-art:${artValue};--champion-art-position:${championAvatarPosition(name, size)}"`
    : "";
  queueChampionVersionLoad();
  return `<span class="champion-avatar champion-avatar--${size}" aria-hidden="true" title="${display}" data-champion-name="${name || ""}" data-monogram="${monogram}"${artStyle}></span>`;
}

function candidateResultToken(match) {
  if (typeof match?.result === "string" && match.result) {
    return match.result;
  }
  if (typeof match?.win === "boolean") {
    return match.win ? "WIN" : "LOSS";
  }
  return "";
}

function candidateIdentityMetaMarkup(match) {
  const tokens = [];
  const role = String(match?.role || "").trim();
  const result = candidateResultToken(match);

  if (role) {
    tokens.push(`<span class="candidate-head__tag">${role}</span>`);
  }

  if (result) {
    tokens.push(
      `<span class="candidate-head__tag candidate-head__tag--result" data-result="${result}">${resultLabel(result)}</span>`,
    );
  }

  return tokens.length ? `<div class="candidate-head__tags">${tokens.join("")}</div>` : "";
}

function parseReportMeta(sample) {
  const detail = String(sample.label || "").split("·")[1]?.trim() || "";
  const [role = "UNKNOWN", result = "UNKNOWN"] = detail.split(/\s+/);
  return { role, result };
}

function classifyTheme(theme) {
  if (/(weak|poor|low|messy|issue|issues|risk|slow|death|late_structure_closeout)/.test(theme)) {
    return "negative";
  }

  if (/(reliable|strong|good|tempo|control|stable|followup|frontline|roaming|objective)/.test(theme)) {
    return "positive";
  }

  return "neutral";
}

function themeLabel(theme) {
  const labels = {
    weak_early_lane_stability: "초반 라인 불안",
    reliable_objective_followup: "오브젝트 합류 안정적",
    poor_post_baron_survivability: "바론 이후 생존 아쉬움",
    low_mid_lane_farm: "파밍 속도 아쉬움",
    strong_objective_tempo: "오브젝트 템포 좋음",
    strong_objective_control: "오브젝트 장악 좋음",
    positioning_risk: "포지셔닝 아쉬움",
    messy_deaths: "불필요한 데스 잦음",
    late_structure_closeout: "후반 마무리 아쉬움",
  };

  return labels[theme] || "";
}

function compactInsightLabel(text) {
  return String(text || "")
    .replace(/주요 /g, "")
    .replace(/이번 판에서 /g, "")
    .replace(/다음 판에서 /g, "")
    .replace(/초반 라인 안정감이 낮았음/g, "초반 라인 불안")
    .replace(/중앙 라인 성장 속도가 너무 느렸음/g, "성장 속도 느림")
    .replace(/바론 이후 생존과 전환이 아쉬웠음/g, "바론 이후 생존/전환 아쉬움")
    .replace(/주요 오브젝트 교전에 꾸준히 합류했음/g, "오브젝트 합류 안정적")
    .replace(/중후반 교전에서 후속 킬 관여를 만들어 냈음/g, "중후반 킬 관여 좋음")
    .replace(/시야 투자량이 높은 편이었음/g, "시야 투자 좋음")
    .replace(/이었음|였음|했음|았음|었음/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildManifestCardSummary(sample) {
  const text = String(sample.theme || "");
  const parts = [];

  if (/초반/.test(text) && /(불안|손해|데스|흔들)/.test(text)) {
    parts.push("초반 불안");
  }
  if (/(오브젝트|드래곤|바론)/.test(text) && /(꾸준|합류|템포|장악|확보)/.test(text)) {
    parts.push("오브젝트 템포 좋음");
  }
  if (/바론/.test(text) && /(전환|생존|압박)/.test(text)) {
    parts.push("바론 이후 전환 아쉬움");
  }
  if (/구조물/.test(text) && /(압박|연결|마무리)/.test(text)) {
    parts.push("구조물 압박 연결");
  }
  if (/(데스|죽|생존)/.test(text) && /(아쉬|불안|흔들)/.test(text)) {
    parts.push("생존 관리 아쉬움");
  }

  if (parts.length > 0) {
    return parts.slice(0, 2).join(" · ");
  }

  return compactInsightLabel(text).slice(0, 42) || sample.label;
}

function buildCandidateCardSummary(match) {
  return [compactQueueLabel(match.queueLabel), `적합도 ${match.sampleFitScore}`].join(" · ");
}

function classifyTrendTag(tag) {
  if (/(좋음|안정|장악|템포|합류|연결|꾸준|승리)/.test(tag)) {
    return "positive";
  }

  if (/(불안|아쉬움|느림|생존|데스|리스크|손해|실패)/.test(tag)) {
    return "negative";
  }

  return "neutral";
}

function buildTrendSnapshot() {
  const samples = state.manifest;
  const current = samples.find((sample) => sample.id === state.currentSampleId) || samples[0];
  const playerAlias = current?.publicAlias || "PlayerAlias#KR1";
  const roleCounts = new Map();
  let wins = 0;
  let losses = 0;
  const tagCounts = new Map();

  for (const sample of samples) {
    const meta = parseReportMeta(sample);
    roleCounts.set(meta.role, (roleCounts.get(meta.role) || 0) + 1);

    if (meta.result === "WIN") {
      wins += 1;
    } else if (meta.result === "LOSS") {
      losses += 1;
    }

    const tags = buildManifestCardSummary(sample)
      .split("·")
      .map((tag) => tag.trim())
      .filter(Boolean);

    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const dominantRoleEntry =
    [...roleCounts.entries()].sort((left, right) => right[1] - left[1])[0] || ["UNKNOWN", 0];
  const dominantRole = dominantRoleEntry[0];
  const dominantRoleCount = dominantRoleEntry[1];
  const recurringTags = [...tagCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([tag, count]) => `${tag} ${count}회`);
  const positiveTags = [...tagCounts.entries()]
    .filter(([tag]) => classifyTrendTag(tag) === "positive")
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([tag, count]) => `${tag} ${count}회`);
  const negativeTags = [...tagCounts.entries()]
    .filter(([tag]) => classifyTrendTag(tag) === "negative")
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([tag, count]) => `${tag} ${count}회`);

  const headline = `${playerAlias} · 리포트 ${samples.length}개 / ${wins}승 ${losses}패 / ${dominantRole} 비중 ${dominantRoleCount}회`;
  const summary =
    recurringTags.length > 0
      ? `반복 신호: ${recurringTags.slice(0, 2).join(" / ")}. 현재 샘플 ${current?.id || "-"} 기준으로 복기 중입니다.`
      : `표본이 적어 누적 추세는 아직 제한적입니다. 샘플이 더 쌓이면 패턴이 선명해집니다.`;

  return {
    headline,
    summary,
    stats: [
      { label: "Reports", value: `${samples.length}개`, note: "저장된 리포트 수" },
      { label: "Record", value: `${wins}승 ${losses}패`, note: "저장 샘플 기준" },
      { label: "Main Role", value: dominantRole, note: `가장 많이 나온 포지션 ${dominantRoleCount}회` },
      { label: "Current", value: current?.id || "-", note: "현재 보고 있는 샘플" },
    ],
    tags: recurringTags,
    positiveTags,
    negativeTags,
  };
}

function renderTrendPanel() {
  if (!dom.trendHeadline || state.manifest.length === 0) {
    return;
  }

  const trend = buildTrendSnapshot();
  dom.trendHeadline.textContent = trend.headline;
  dom.trendSummary.textContent = trend.summary;
  dom.trendStats.innerHTML = trend.stats
    .map(
      (item) => `
        <article class="trend-stat">
          <span class="meta-label">${item.label}</span>
          <strong>${item.value}</strong>
          <span class="trend-stat__note">${item.note}</span>
        </article>
      `,
    )
    .join("");

  dom.trendTags.innerHTML =
    trend.tags.length > 0
      ? trend.tags.map((tag) => `<span class="trend-tag">${tag}</span>`).join("")
      : `<span class="trend-tag">표본 적음</span>`;

  if (dom.trendStrengths) {
    dom.trendStrengths.innerHTML =
      trend.positiveTags.length > 0
        ? trend.positiveTags.map((tag) => `<div class="trend-list__item">${tag}</div>`).join("")
        : `<div class="trend-list__item">반복 강점 표본 적음</div>`;
  }

  if (dom.trendWeaknesses) {
    dom.trendWeaknesses.innerHTML =
      trend.negativeTags.length > 0
        ? trend.negativeTags.map((tag) => `<div class="trend-list__item">${tag}</div>`).join("")
        : `<div class="trend-list__item">반복 약점 표본 적음</div>`;
  }
}

function buildCompactHeadline(sample) {
  const match = sampleMatchSummary(sample);
  const resultText = match.result ? resultLabel(match.result) : "결과 미상";
  const base = [match.champion, match.role, resultText].filter(Boolean).join(" ");
  const candidateThemes = sample.normalized.derivedSignals?.candidateThemes || [];

  let positive = "";
  let negative = "";

  for (const theme of candidateThemes) {
    const label = themeLabel(theme);
    if (!label) {
      continue;
    }

    const kind = classifyTheme(theme);
    if (kind === "positive" && !positive) {
      positive = label;
    }
    if (kind === "negative" && !negative) {
      negative = label;
    }
  }

  if (!positive) {
    positive = compactInsightLabel(sample.analysis.strengths?.[0]?.title);
  }

  if (!negative) {
    negative = compactInsightLabel(sample.analysis.weaknesses?.[0]?.title);
  }

  if (match.result === "WIN" && positive && negative) {
    return `${base} · ${positive} / ${negative}`;
  }

  if (match.result === "LOSS" && negative && positive) {
    return `${base} · ${negative} / ${positive}`;
  }

  if (positive) {
    return `${base} · ${positive}`;
  }

  if (negative) {
    return `${base} · ${negative}`;
  }

  return base || match.headline || sample.theme || sample.sampleId;
}

function sampleMatchSummary(sample) {
  const analysisMatch = sample.analysis?.matchSummary || {};
  const normalizedMatch = sample.normalized?.matchInfo || {};

  return {
    matchId: analysisMatch.matchId || normalizedMatch.matchId || sample.sampleId,
    champion: analysisMatch.champion || normalizedMatch.champion || "",
    role: analysisMatch.role || normalizedMatch.position || "",
    result: analysisMatch.result || normalizedMatch.result || "",
    queueType: analysisMatch.queueType || normalizedMatch.queueLabel || "",
    gameVersion: analysisMatch.gameVersion || normalizedMatch.gameVersion || "",
    headline: analysisMatch.headline || sample.theme || "",
  };
}

function visibleReportSamples() {
  const samples = state.manifest || [];
  if (samples.length <= REPORT_STRIP_LIMIT) {
    return samples;
  }

  const currentSample = samples.find((sample) => sample.id === state.currentSampleId);
  const visible = currentSample ? [currentSample] : [];

  for (const sample of samples) {
    if (visible.length >= REPORT_STRIP_LIMIT) break;
    if (sample.id !== currentSample?.id) {
      visible.push(sample);
    }
  }

  return visible;
}

async function fetchJson(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `${path} 요청 실패`);
  }
  return payload;
}

async function loadManifest() {
  try {
    const apiManifest = await fetchJson("/api/samples");
    return apiManifest.samples || [];
  } catch (error) {
    const fileManifest = await fetchJson("/data/samples/manifest.json");
    return fileManifest.samples || [];
  }
}

async function loadSampleBundle(sampleId) {
  try {
    return await fetchJson(`/api/samples/${sampleId}`);
  } catch (error) {
    const entry = state.manifest.find((sample) => sample.id === sampleId);
    if (!entry) {
      throw error;
    }

    const [normalized, analysis] = await Promise.all([
      fetchJson(entry.normalizedPath),
      fetchJson(entry.analysisPath),
    ]);

    // fallback에서도 comparison 로드 시도
    let comparison = null;
    const compPath = entry.normalizedPath.replace("normalized-match.json", "comparison-result.json");
    try { comparison = await fetchJson(compPath); } catch {}

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
}

function evidenceMap(sample) {
  return new Map(
    (sample.normalized.timelineEvents || []).map((entry) => [
      entry.eventId,
      {
        eventId: entry.eventId,
        timestamp: entry.timestampLabel || entry.timestamp || "-",
        eventType: entry.eventType || "-",
        summary: entry.summary || "",
        statNote: entry.laneHint ? `위치 ${entry.laneHint}` : entry.phase ? `${entry.phase} 구간` : "",
      },
    ]),
  );
}

function renderSampleSwitcher() {
  dom.sampleSwitcher.innerHTML = state.manifest
    .map(
      (sample) => `
        <button class="sample-chip" type="button" data-sample-button="${sample.id}" data-active="${sample.id === state.currentSampleId}" aria-pressed="${sample.id === state.currentSampleId}">
          <div class="sample-chip__row">
            ${championAvatarMarkup(sample.champion, "small")}
            <div class="sample-chip__copy">
              <em class="sample-chip__champion">${championDisplayName(sample.champion)}</em>
              <span>${sample.label}</span>
              <strong>${sample.publicAlias}</strong>
            </div>
          </div>
        </button>
      `,
    )
    .join("");

  if (dom.reportStrip) {
    dom.reportStrip.innerHTML = visibleReportSamples()
      .map((sample) => {
        const meta = parseReportMeta(sample);
        const resultText = meta.result === "WIN" ? "승리" : meta.result === "LOSS" ? "패배" : meta.result;

        return `
          <button class="report-card" type="button" data-sample-button="${sample.id}" data-active="${sample.id === state.currentSampleId}" aria-pressed="${sample.id === state.currentSampleId}">
            <div class="report-card__top">
              <span class="meta-label">${sample.id}</span>
              <span class="report-card__state">${sample.id === state.currentSampleId ? "CURRENT" : "ARCHIVE"}</span>
            </div>
            <div class="report-card__title">
              ${championAvatarMarkup(sample.champion, "medium")}
              <div>
                <span class="report-card__champion">${championDisplayName(sample.champion)}</span>
                <h4>${sample.label}</h4>
              </div>
            </div>
            <div class="report-card__badges">
              <span class="report-badge">${meta.role}</span>
              <span class="report-badge report-badge--result" data-result="${meta.result}">${resultText}</span>
            </div>
            <p>${buildManifestCardSummary(sample)}</p>
            <strong>${sample.publicAlias}</strong>
          </button>
        `;
      })
      .join("");
  }

  renderTrendPanel();
}

function renderHero(sample) {
  const match = sampleMatchSummary(sample);
  const coachSummary = sample.analysis.coachSummary || {};
  const resultText = match.result ? resultLabel(match.result) : "결과 미상";
  dom.heroPlayer.textContent = sample.publicAlias;
  dom.heroDate.textContent = sample.collectedDate;

  dom.headline.textContent = buildCompactHeadline(sample);
  dom.headline.title = match.headline || dom.headline.textContent;
  if (dom.quickSummary) {
    const primary = coachSummary.overallSummary?.split(/[.!?]\s/)[0]?.trim();
    const fallback = coachSummary.gameFlowSummary?.slice(0, 120)?.trim();
    dom.quickSummary.textContent = primary || fallback || sample.theme || "";
  }
  dom.resultPill.dataset.result = match.result || "UNKNOWN";
  dom.resultPill.textContent = [resultText, coachSummary.winLossReason].filter(Boolean).join(" · ");

  const championName = championDisplayName(match.champion);
  dom.snapshotChampion.textContent = championName;
  if (dom.snapshotChampionIcon) {
    dom.snapshotChampionIcon.textContent = "";
    dom.snapshotChampionIcon.dataset.monogram = championMonogram(match.champion);
    dom.snapshotChampionIcon.dataset.championName = match.champion || "";
    dom.snapshotChampionIcon.title = championName;
    applyChampionAvatarPresentation(dom.snapshotChampionIcon, match.champion);
    queueChampionVersionLoad();
  }
  if (dom.snapshotRole) dom.snapshotRole.textContent = match.role || "—";
  if (dom.snapshotQueue) dom.snapshotQueue.textContent = compactQueueLabel(match.queueType);
  dom.snapshotDuration.textContent = sample.normalized?.matchInfo?.durationLabel || "—";
  dom.snapshotPatch.textContent = compactPatchLabel(match.gameVersion);
  if (dom.snapshotCsPerMin) {
    const cs = sample.normalized?.playerStats?.csPerMinute;
    dom.snapshotCsPerMin.textContent = typeof cs === "number" ? cs.toFixed(2) : "—";
  }

  // 마스터리 정보 표시
  if (dom.snapshotMastery && dom.snapshotMasteryText) {
    const mastery = findMasteryForChampion(match.champion);
    if (mastery) {
      dom.snapshotMastery.hidden = false;
      dom.snapshotMasteryText.textContent = `Lv.${mastery.championLevel} · ${formatMasteryPoints(mastery.championPoints)}`;
    } else {
      dom.snapshotMastery.hidden = true;
    }
  }

  // 챔피언 배너 이미지
  const overviewTab = document.getElementById("tab-overview");
  if (overviewTab) {
    let banner = overviewTab.querySelector(".champion-hero-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.className = "champion-hero-banner";
      overviewTab.prepend(banner);
    }
    const artUrl = championArtUrl(match.champion);
    banner.style.backgroundImage = artUrl ? `url('${artUrl}')` : "";
    banner.dataset.result = match.result || "";
    banner.innerHTML = `
      <div class="champion-hero-banner__overlay">
        <span class="champion-hero-banner__name">${championName}</span>
        <span class="champion-hero-banner__result" data-result="${match.result || ""}">${resultText}</span>
      </div>
    `;
  }

}

function renderStats(sample) {
  const ps = sample.normalized?.playerStats;
  const tc = sample.normalized?.teamContext;
  if (!ps) {
    dom.statRibbon.innerHTML = '<p class="muted">스탯 데이터가 없습니다.</p>';
    return;
  }
  const stats = [
    {
      label: "KDA",
      value: `${ps.kills ?? 0}/<span class="kda-death">${ps.deaths ?? 0}</span>/${ps.assists ?? 0}`,
      note: `배수 ${(ps.kda ?? 0).toFixed(2)}`,
    },
    {
      label: "CS",
      value: formatNumber(ps.cs ?? 0),
      note: `분당 ${(ps.csPerMinute ?? 0).toFixed(2)}`,
    },
    {
      label: "Gold",
      value: formatNumber(ps.goldEarned ?? 0),
      note: "누적 획득 골드",
    },
    {
      label: "Damage",
      value: formatNumber(ps.damageToChampions ?? 0),
      note: "챔피언 대상 피해",
    },
    {
      label: "Vision",
      value: formatNumber(ps.visionScore ?? 0),
      note: "시야 점수",
    },
    {
      label: "KP",
      value: formatPercent(ps.killParticipation ?? 0),
      note: `팀 킬 ${tc?.teamTotalKills ?? 0}`,
    },
  ];

  dom.statRibbon.innerHTML = stats
    .map(
      (stat) => `
        <article class="stat-card">
          <span class="meta-label">${stat.label}</span>
          <strong>${stat.value}</strong>
          <span class="stat-note">${stat.note}</span>
        </article>
      `,
    )
    .join("");
}

function renderPhases(sample) {
  const phaseCards =
    sample.analysis.phaseSummaries && sample.analysis.phaseSummaries.length > 0
      ? sample.analysis.phaseSummaries
      : Object.entries(sample.normalized.phaseContext || {}).map(([phase, info]) => ({
          phase: phase.toUpperCase(),
          rating: info.deaths >= 4 ? "BAD" : info.kills + info.assists >= info.deaths ? "GOOD" : "OK",
          summary: `${info.kills}킬 ${info.deaths}데스 ${info.assists}어시스트`,
          focus: `주요 이벤트 ${info.notableEventCount}건`,
        }));

  dom.phaseGrid.innerHTML = phaseCards
    .map(
      (phase) => `
        <article class="phase-card" data-rating="${phase.rating}">
          <div class="phase-card__top">
            <span class="phase-tag">${phase.phase}</span>
            <span class="phase-rating">${ratingLabel(phase.rating)}</span>
          </div>
          <p class="phase-summary">${phase.summary}</p>
          <p class="phase-focus">${phase.focus}</p>
        </article>
      `,
    )
    .join("");
}

function renderInsightCards(host, items, kind, sample) {
  const evidence = evidenceMap(sample);

  host.innerHTML = items
    .map((item) => {
      const linkedEvidence = (item.relatedEventIds || [])
        .map((id) => evidence.get(id))
        .filter(Boolean)
        .slice(0, 2);

      const footerText = kind === "strength" ? item.impact : item.improvementHint;
      const footer = footerText ? `<p class="insight-footer">${footerText}</p>` : "";
      const evidenceText = item.evidence || linkedEvidence[0]?.summary || "";

      return `
        <article class="insight-card" data-kind="${kind}">
          <div class="insight-card__header">
            <h4>${item.title}</h4>
            <span>${kind === "strength" ? "잘한 점" : "개선 포인트"}</span>
          </div>
          <p class="insight-body">${item.description}</p>
          <p class="insight-evidence">${evidenceText}</p>
          ${footer}
          <div class="chip-row">
            ${linkedEvidence
              .map(
                (entry) => `
                  <span class="event-chip">${entry.timestamp} · ${entry.eventType}</span>
                `,
              )
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderChecklist(sample) {
  const priorityToken = (priority) => {
    if (typeof priority === "number") return `P${priority}`;
    if (priority === "high") return "HIGH";
    if (priority === "medium") return "MED";
    if (priority === "low") return "LOW";
    return "TIP";
  };

  dom.checklist.innerHTML = sample.analysis.actionChecklist
    .map(
      (item) => `
        <li class="checklist-item">
          <div class="checklist-priority">${priorityToken(item.priority)}</div>
          <div>
            <strong>${item.action || item.text || item.label || ""}</strong>
            ${item.reason || item.description ? `<p>${item.reason || item.description}</p>` : ""}
          </div>
        </li>
      `,
    )
    .join("");
}

function renderKeyMoments(sample) {
  dom.keyMoments.innerHTML = sample.analysis.keyMoments
    .map(
      (moment) => `
        <article class="moment-card">
          <div class="moment-stamp">
            <span>${moment.timestamp || moment.timestampLabel}</span>
            <strong>${moment.phase}</strong>
          </div>
          <div class="moment-copy">
            <h4>${moment.label || moment.title}</h4>
            <p>${moment.reason || moment.description}</p>
            <span>${moment.impact || ""}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function collectEvidenceEventIds(node) {
  const ids = new Set();
  const walk = (value) => {
    if (value == null) return;
    if (typeof value === "string") {
      if (/^evt_\w+$/.test(value)) ids.add(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };
  walk(node);
  return [...ids];
}

function renderEvidence(sample) {
  const timelineMap = evidenceMap(sample);
  const idx = sample.analysis?.evidenceIndex;

  const isRuleBasedArray =
    Array.isArray(idx) && idx.length > 0 && typeof idx[0] === "object" && !Array.isArray(idx[0]);

  let evidenceEntries;
  if (isRuleBasedArray) {
    evidenceEntries = idx;
  } else {
    let ids = collectEvidenceEventIds(idx);

    // fallback: evidenceIndex에서 ID를 못 뽑으면 인사이트 항목의 relatedEventIds 합성
    if (ids.length === 0) {
      const insights = [
        ...(sample.analysis?.strengths || []),
        ...(sample.analysis?.weaknesses || []),
        ...(sample.analysis?.keyMoments || []),
      ];
      ids = [...new Set(insights.flatMap((it) => it.relatedEventIds || []))];
    }

    const order = new Map(
      (sample.normalized?.timelineEvents || []).map((e, i) => [e.eventId, e.timestampMs ?? i]),
    );
    evidenceEntries = ids
      .map((id) => timelineMap.get(id))
      .filter(Boolean)
      .sort((a, b) => (order.get(a.eventId) ?? 0) - (order.get(b.eventId) ?? 0));
  }

  if (evidenceEntries.length === 0) {
    dom.evidence.innerHTML = '<p class="muted">근거 이벤트 데이터가 없습니다.</p>';
    return;
  }

  dom.evidence.innerHTML = evidenceEntries
    .map(
      (entry) => `
        <article class="evidence-item">
          <div class="evidence-stamp">
            <span>${entry.timestamp || entry.timestampLabel || "—"}</span>
            <strong>${entry.eventType || "—"}</strong>
          </div>
          <div class="evidence-copy">
            <p>${entry.summary || ""}</p>
            <span>${entry.statNote || entry.laneHint || ""}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderPlaytimeScore(sample) {
  const score = sample.normalized?.playtimeScore;
  if (!score) {
    dom.scorePanel.innerHTML = '<p class="muted">이 샘플에는 스코어 데이터가 없습니다.</p>';
    return;
  }

  const categoryLabels = {
    combat: "전투력",
    income: "수입력",
    vision: "시야",
    survival: "생존력",
    objective: "오브젝트",
    structure: "구조물",
  };

  function barColor(v) {
    if (v >= 8) return "var(--mint)";
    if (v >= 5) return "var(--accent)";
    return "var(--rose)";
  }

  const bars = Object.entries(score.categories).map(([key, val]) => `
    <div class="score-bar-item">
      <div class="score-bar-header">
        <span>${categoryLabels[key]}</span>
        <strong>${val}</strong>
      </div>
      <div class="score-bar-track">
        <div class="score-bar-fill" style="width: ${val * 10}%; background: ${barColor(val)}"></div>
      </div>
    </div>
  `).join("");

  dom.scorePanel.innerHTML = `
    <div class="score-overall">
      <div class="score-overall-number" style="color: ${barColor(score.overall)}">${score.overall}</div>
      <div class="score-overall-label">${score.label}<span class="score-badge score-badge--${score.overall >= 8 ? "mvp" : score.overall >= 6 ? "good" : "avg"}">${score.label}</span></div>
      <div class="score-overall-sub">/ 10</div>
    </div>
    <div class="score-bars">${bars}</div>
  `;
}

function renderLaningStats(sample) {
  const cs = sample.normalized?.challengeStats;
  if (!cs || !dom.laningStats) {
    if (dom.laningStats) dom.laningStats.innerHTML = "";
    return;
  }

  const items = [
    { label: "분당 데미지", value: Math.round(cs.damagePerMinute), unit: "DPM" },
    { label: "분당 골드", value: Math.round(cs.goldPerMinute), unit: "GPM" },
    { label: "팀 데미지 비중", value: `${(cs.teamDamagePercentage * 100).toFixed(1)}%`, unit: "" },
    { label: "솔로킬", value: cs.soloKills, unit: "" },
    { label: "10분 CS", value: cs.laneMinionsFirst10Minutes, unit: "" },
    { label: "CS 최대 우위", value: cs.maxCsAdvantageOnLaneOpponent?.toFixed(1) || 0, unit: "" },
    { label: "레벨 최대 우위", value: cs.maxLevelLeadLaneOpponent || 0, unit: "" },
    { label: "터렛 플레이트", value: cs.turretPlatesTaken, unit: "" },
    { label: "컨트롤 와드", value: cs.controlWardsPlaced, unit: "" },
    { label: "스킬샷 회피", value: cs.skillshotsDodged, unit: "" },
  ];

  dom.laningStats.innerHTML = `
    <h3 class="laning-stats-title">라인전 & 고급 지표</h3>
    <div class="laning-stats-grid">
      ${items.map((i) => `
        <div class="laning-stat-item">
          <span class="laning-stat-value">${i.value}${i.unit ? ` <small>${i.unit}</small>` : ""}</span>
          <span class="laning-stat-label">${i.label}</span>
        </div>
      `).join("")}
    </div>
  `;
}

// ─── Dual-track timeline ──────────────────────────────────────────────

const ALLY_EVENT_TYPES = new Set([
  "CHAMPION_KILL", "SKIRMISH_WIN", "TEAMFIGHT_FOLLOWUP",
  "ROAM_SUCCESS", "OBJECTIVE_SETUP_WIN", "TOWER_TAKE",
  "LANE_PRIORITY",
]);

const ENEMY_EVENT_TYPES = new Set([
  "PLAYER_DEATH", "BAD_ENGAGE", "ROAM_FAIL",
  "SKIRMISH_LOSS", "OBJECTIVE_SETUP_FAIL",
]);

const EVENT_ICONS = {
  CHAMPION_KILL: "\u2694\uFE0F",
  PLAYER_DEATH: "\uD83D\uDC80",
  DRAGON_FIGHT: "\uD83D\uDC09",
  BARON_FIGHT: "\uD83D\uDC32",
  TOWER_TAKE: "\uD83C\uDFF0",
  SKIRMISH_WIN: "\u2694\uFE0F",
  TEAMFIGHT_FOLLOWUP: "\uD83E\uDD1D",
  OBJECTIVE_SETUP_WIN: "\u2705",
  OBJECTIVE_SETUP_FAIL: "\u274C",
  HORDE: "\uD83D\uDC7E",
};

const LANE_LABELS = {
  MID_LANE: "\uBBF8\uB4DC", MID_RIVER: "\uBBF8\uB4DC",
  TOP_LANE: "\uD0D1", TOP_RIVER: "\uD0D1", BARON_RIVER: "\uD0D1",
  BOT_LANE: "\uBD07", BOT_RIVER: "\uBD07", DRAGON_RIVER: "\uBD07",
  TOP_JUNGLE: "\uC815\uAE00", BOT_JUNGLE: "\uC815\uAE00",
};

function classifyTimelineEvent(evt, objectiveTimeline) {
  const type = evt.eventType;
  // For DRAGON_FIGHT / BARON_FIGHT, check objectiveTimeline for team info
  if (type === "DRAGON_FIGHT" || type === "BARON_FIGHT") {
    const objMatch = (objectiveTimeline || []).find((o) =>
      Math.abs(parseMsFromLabel(o.timeLabel) - evt.timestampMs) < 30000 &&
      o.type === "OBJECTIVE"
    );
    if (objMatch) {
      return {
        track: objMatch.team === "ALLY" ? "ALLY" : "ENEMY",
        laneZone: LANE_LABELS[evt.laneHint] || "",
        icon: EVENT_ICONS[type] || "\u26A0\uFE0F",
      };
    }
    // Default: if player involved positively
    return {
      track: evt.isPlayerInvolved ? "ALLY" : "ENEMY",
      laneZone: LANE_LABELS[evt.laneHint] || "",
      icon: EVENT_ICONS[type] || "\u26A0\uFE0F",
    };
  }

  if (ALLY_EVENT_TYPES.has(type)) {
    return { track: "ALLY", laneZone: LANE_LABELS[evt.laneHint] || "", icon: EVENT_ICONS[type] || "\u2694\uFE0F" };
  }
  if (ENEMY_EVENT_TYPES.has(type)) {
    return { track: "ENEMY", laneZone: LANE_LABELS[evt.laneHint] || "", icon: EVENT_ICONS[type] || "\u26A0\uFE0F" };
  }
  // Fallback
  return {
    track: evt.isPlayerInvolved ? "ALLY" : "ENEMY",
    laneZone: LANE_LABELS[evt.laneHint] || "",
    icon: EVENT_ICONS[type] || "\u2B50",
  };
}

function parseMsFromLabel(label) {
  if (!label) return 0;
  const parts = label.split(":");
  return ((parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0)) * 1000;
}

function buildDualTimelineData(sample) {
  const norm = sample.normalized;
  if (!norm) return null;

  const events = (norm.timelineEvents || []).map((evt) => {
    const cls = classifyTimelineEvent(evt, norm.objectiveTimeline);
    return { ...evt, ...cls };
  });

  // Also add objective events that aren't already in timelineEvents
  (norm.objectiveTimeline || []).forEach((obj) => {
    const objMs = parseMsFromLabel(obj.timeLabel);
    const alreadyPresent = events.some((e) => Math.abs(e.timestampMs - objMs) < 10000 && (
      e.eventType === "DRAGON_FIGHT" || e.eventType === "BARON_FIGHT" || e.eventType === "TOWER_TAKE"
    ));
    if (!alreadyPresent) {
      events.push({
        eventId: `obj_${obj.timeLabel}`,
        timestampMs: objMs,
        timestampLabel: obj.timeLabel,
        phase: obj.phase,
        eventType: obj.type === "STRUCTURE" ? "TOWER_TAKE" : "DRAGON_FIGHT",
        importance: obj.type === "OBJECTIVE" ? 4 : 3,
        isPlayerInvolved: false,
        laneHint: obj.lane || "",
        summary: obj.label,
        track: obj.team === "ALLY" ? "ALLY" : "ENEMY",
        laneZone: LANE_LABELS[obj.lane] || "",
        icon: obj.type === "STRUCTURE" ? "\uD83C\uDFF0" : "\uD83D\uDC09",
      });
    }
  });

  events.sort((a, b) => a.timestampMs - b.timestampMs);

  const totalMs = (norm.matchInfo?.durationSeconds || 1800) * 1000;
  const phases = [
    { phase: "EARLY", startMs: 0, endMs: Math.min(900000, totalMs) },
    { phase: "MID", startMs: 900000, endMs: Math.min(1800000, totalMs) },
  ];
  if (totalMs > 1800000) {
    phases.push({ phase: "LATE", startMs: 1800000, endMs: totalMs });
  }

  return { events, phases, totalMs };
}

function computeMomentum(events, totalMs) {
  const segMs = 300000; // 5 minutes
  const segments = [];
  for (let start = 0; start < totalMs; start += segMs) {
    const end = Math.min(start + segMs, totalMs);
    const segEvents = events.filter((e) => e.timestampMs >= start && e.timestampMs < end);
    const ally = segEvents.filter((e) => e.track === "ALLY").length;
    const enemy = segEvents.filter((e) => e.track === "ENEMY").length;
    segments.push({ start, end, ally, enemy, total: ally + enemy });
  }
  return segments;
}

function renderDualTimeline(sample) {
  if (!dom.dualTimeline) return;

  if (dom.dualDetail) {
    dom.dualDetail.classList.remove("dual-tl-detail--open");
    dom.dualDetail.innerHTML = "";
  }

  const data = buildDualTimelineData(sample);
  if (!data || data.events.length === 0) {
    dom.dualTimeline.innerHTML = '<p class="muted">\uB4C0\uC5BC\uD2B8\uB799 \uD0C0\uC784\uB77C\uC778 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    return;
  }

  const { events, phases, totalMs } = data;
  const momentum = computeMomentum(events, totalMs);

  // Phase bands
  const phaseBands = phases.map((p) => {
    const widthPct = ((p.endMs - p.startMs) / totalMs) * 100;
    const phaseClass = p.phase === "EARLY" ? "early" : p.phase === "MID" ? "mid" : "late";
    const label = p.phase === "EARLY" ? "\uCD08\uBC18" : p.phase === "MID" ? "\uC911\uBC18" : "\uD6C4\uBC18";
    return `<div class="dual-tl-phase dual-tl-phase--${phaseClass}" style="width:${widthPct}%">
      <span class="dual-tl-phase-label">${label}</span>
    </div>`;
  }).join("");

  // Tick marks every 5 min
  const ticks = [];
  for (let ms = 300000; ms < totalMs; ms += 300000) {
    const leftPct = (ms / totalMs) * 100;
    const label = `${Math.floor(ms / 60000)}:00`;
    ticks.push(`<div class="dual-tl-tick" style="left:${leftPct}%"></div>`);
    ticks.push(`<div class="dual-tl-tick-label" style="left:${leftPct}%">${label}</div>`);
  }

  // Resolve vertical stacking for overlapping events
  const allyEvents = events.filter((e) => e.track === "ALLY");
  const enemyEvents = events.filter((e) => e.track === "ENEMY");

  function resolveVerticalOffset(evts) {
    const placed = [];
    return evts.map((e) => {
      const leftPct = (e.timestampMs / totalMs) * 100;
      let row = 0;
      for (const p of placed) {
        if (Math.abs(p.leftPct - leftPct) < 8) {
          row = Math.max(row, p.row + 1);
        }
      }
      placed.push({ leftPct, row });
      return { ...e, leftPct, row };
    });
  }

  const allyPlaced = resolveVerticalOffset(allyEvents);
  const enemyPlaced = resolveVerticalOffset(enemyEvents);

  function renderEventChip(e, track) {
    const vertOffset = track === "ALLY"
      ? `bottom: ${4 + e.row * 54}px`
      : `top: ${4 + e.row * 54}px`;
    const summary = e.summary || e.eventType;
    const importance = Number.isFinite(Number(e.importance)) ? Number(e.importance) : 0;
    return `<div class="dual-tl-event dual-tl-event--${track.toLowerCase()}"
        style="left:${e.leftPct}%; ${vertOffset}"
        data-importance="${importance}"
        data-event-id="${escapeAttr(e.eventId || "")}"
        title="${escapeAttr(summary)}">
      <span class="dual-tl-event-icon">${escapeHtml(e.icon || "")}</span>
      <span class="dual-tl-event-time">${escapeHtml(e.timestampLabel || "")}</span>
      <span class="dual-tl-event-summary">${escapeHtml(summary)}</span>
      ${e.laneZone ? `<span class="dual-tl-event-lane">${escapeHtml(e.laneZone)}</span>` : ""}
    </div>`;
  }

  const allyChips = allyPlaced.map((e) => renderEventChip(e, "ALLY")).join("");
  const enemyChips = enemyPlaced.map((e) => renderEventChip(e, "ENEMY")).join("");

  // Segment click zones
  const segmentZones = momentum.map((seg, i) => {
    const leftPct = (seg.start / totalMs) * 100;
    const widthPct = ((seg.end - seg.start) / totalMs) * 100;
    return `<div class="dual-tl-segment" data-seg-index="${i}" data-seg-start="${seg.start}" data-seg-end="${seg.end}"
        style="left:${leftPct}%; width:${widthPct}%"></div>`;
  }).join("");

  // Momentum bar
  const momentumBar = momentum.map((seg) => {
    const widthPct = ((seg.end - seg.start) / totalMs) * 100;
    let cls = "neutral";
    if (seg.ally > seg.enemy) cls = "ally";
    else if (seg.enemy > seg.ally) cls = "enemy";
    return `<div class="dual-tl-momentum-seg dual-tl-momentum-seg--${cls}" style="width:${widthPct}%"></div>`;
  }).join("");

  dom.dualTimeline.innerHTML = `
    <div class="dual-tl-scroll">
      <div class="dual-tl-phases">${phaseBands}</div>
      <div class="dual-tl-axis"></div>
      ${ticks.join("")}
      <div class="dual-tl-track--ally">
        <span class="dual-tl-track-label">\uC544\uAD70</span>
        ${allyChips}
      </div>
      <div class="dual-tl-track--enemy">
        <span class="dual-tl-track-label">\uC801\uAD70</span>
        ${enemyChips}
      </div>
      ${segmentZones}
    </div>
    <div class="dual-tl-momentum">${momentumBar}</div>
  `;

  // Store data for detail panel
  dom.dualTimeline._data = data;
  dom.dualTimeline._momentum = momentum;
  dom.dualTimeline._analysis = sample.analysis;
}

function handleDualTimelineClick(event) {
  if (!dom.dualTimeline) return;
  const seg = event.target.closest(".dual-tl-segment");
  if (!seg || !dom.dualTimeline.contains(seg)) return;

  dom.dualTimeline.querySelectorAll(".dual-tl-segment").forEach((segment) => {
    segment.classList.remove("dual-tl-segment--active");
  });
  seg.classList.add("dual-tl-segment--active");

  renderDualTimelineDetail(
    parseInt(seg.dataset.segStart, 10),
    parseInt(seg.dataset.segEnd, 10),
    dom.dualTimeline._data,
    dom.dualTimeline._momentum,
    dom.dualTimeline._analysis,
  );
}

function bindDualTimelineEvents() {
  if (!dom.dualTimeline || dom.dualTimeline.dataset.bound === "true") return;
  dom.dualTimeline.addEventListener("click", handleDualTimelineClick);
  dom.dualTimeline.dataset.bound = "true";
}

function renderDualTimelineDetail(startMs, endMs, data, momentum, analysis) {
  if (!dom.dualDetail) return;
  if (!data) return;

  const segEvents = data.events.filter((e) => e.timestampMs >= startMs && e.timestampMs < endMs);
  const allyEvts = segEvents.filter((e) => e.track === "ALLY");
  const enemyEvts = segEvents.filter((e) => e.track === "ENEMY");

  const startLabel = `${Math.floor(startMs / 60000)}:00`;
  const endLabel = `${Math.floor(endMs / 60000)}:00`;

  // Find matching phase summary
  const phaseSummaries = analysis?.phaseSummaries || [];
  let phaseNote = "";
  for (const ps of phaseSummaries) {
    const phaseStart = ps.phase === "EARLY" ? 0 : ps.phase === "MID" ? 900000 : 1800000;
    const phaseEnd = ps.phase === "EARLY" ? 900000 : ps.phase === "MID" ? 1800000 : Infinity;
    if (startMs < phaseEnd && endMs > phaseStart) {
      const ratingEmoji = ps.rating === "GOOD" ? "\uD83D\uDFE2" : ps.rating === "BAD" ? "\uD83D\uDD34" : "\uD83D\uDFE1";
      const phaseLabel = ps.phase === "EARLY" ? "\uCD08\uBC18" : ps.phase === "MID" ? "\uC911\uBC18" : "\uD6C4\uBC18";
      phaseNote = `<div class="dual-tl-detail-phase">
        ${ratingEmoji} <strong>${escapeHtml(phaseLabel)}</strong>: ${escapeHtml(ps.summary || "")}
        ${ps.focus ? `<br><em>${escapeHtml(ps.focus)}</em>` : ""}
      </div>`;
      break;
    }
  }

  function renderDetailEvent(e) {
    const summary = e.summary || e.eventType;
    return `<div class="dual-tl-detail-event">
      <span class="dual-tl-detail-event-time">${escapeHtml(e.icon || "")} ${escapeHtml(e.timestampLabel || "")}</span>
      ${e.laneZone ? `<span class="dual-tl-event-lane">${escapeHtml(e.laneZone)}</span>` : ""}
      <div>${escapeHtml(summary)}</div>
    </div>`;
  }

  dom.dualDetail.innerHTML = `
    <div class="dual-tl-detail-header">
      <h4>${startLabel} ~ ${endLabel}</h4>
      <div class="dual-tl-detail-momentum">
        <span class="ally-count">\uC544\uAD70 <strong>${allyEvts.length}</strong></span>
        vs
        <span class="enemy-count">\uC801\uAD70 <strong>${enemyEvts.length}</strong></span>
      </div>
    </div>
    <div class="dual-tl-detail-grid">
      <div class="dual-tl-detail-col dual-tl-detail-col--ally">
        <h5>\uC544\uAD70 \uD589\uB3D9</h5>
        ${allyEvts.length > 0 ? allyEvts.map(renderDetailEvent).join("") : '<p class="muted">\uC774 \uAD6C\uAC04\uC5D0 \uC544\uAD70 \uC774\uBCA4\uD2B8 \uC5C6\uC74C</p>'}
      </div>
      <div class="dual-tl-detail-col dual-tl-detail-col--enemy">
        <h5>\uC801\uAD70 \uD589\uB3D9</h5>
        ${enemyEvts.length > 0 ? enemyEvts.map(renderDetailEvent).join("") : '<p class="muted">\uC774 \uAD6C\uAC04\uC5D0 \uC801\uAD70 \uC774\uBCA4\uD2B8 \uC5C6\uC74C</p>'}
      </div>
    </div>
    ${phaseNote}
  `;
  dom.dualDetail.classList.add("dual-tl-detail--open");
}

function renderWardTimeline(sample) {
  const ward = sample.normalized?.wardTimeline;
  if (!ward) {
    dom.wardSummary.innerHTML = "";
    dom.wardEvents.innerHTML = '<p class="muted">와드 데이터가 없습니다.</p>';
    return;
  }

  const s = ward.summary;
  dom.wardSummary.innerHTML = `
    <div class="ward-summary-grid">
      <div class="ward-stat"><strong>${s.totalPlaced}</strong><span>설치</span></div>
      <div class="ward-stat"><strong>${s.totalKilled}</strong><span>제거</span></div>
      <div class="ward-stat"><strong>${s.controlWardsPlaced}</strong><span>컨트롤</span></div>
      <div class="ward-stat"><strong>${s.wardsPerMinute}</strong><span>분당</span></div>
    </div>
    <div class="ward-phase-bar">
      <span>초반 ${s.byPhase.EARLY}</span>
      <span>중반 ${s.byPhase.MID}</span>
      <span>후반 ${s.byPhase.LATE}</span>
    </div>
  `;

  const wardLabel = { YELLOW_TRINKET: "노랑 와드", CONTROL_WARD: "컨트롤 와드", SIGHT_WARD: "시야 와드", BLUE_TRINKET: "파랑 와드" };
  dom.wardEvents.innerHTML = ward.events.length > 0
    ? ward.events.slice(0, 30).map((e) => `
      <span class="ward-event-chip ward-event-chip--${e.action === "PLACED" ? "placed" : "killed"}">
        ${e.timeLabel} ${e.action === "PLACED" ? "설치" : "제거"} ${wardLabel[e.wardType] || e.wardType}
      </span>
    `).join("")
    : '<p class="muted">와드 이벤트 없음</p>';
}

function itemCdnVersion(sample) {
  const raw = String(sample.normalized?.matchInfo?.gameVersion || "").trim();
  const parts = raw.split(".");
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[1]}.1`;
  }
  return championCdnVersion || "";
}

function renderBuildTimeline(sample) {
  const items = sample.normalized?.itemTimeline;
  if (!items || items.length === 0) {
    dom.buildTimeline.innerHTML = '<p class="muted">빌드 데이터가 없습니다.</p>';
    return;
  }

  // 핵심 아이템만 필터 (itemId >= 3000 이상 = 완성 아이템, 부츠 등)
  const majorItems = items.filter((i) => i.itemId >= 3000 || i.itemId === 2031 || i.itemId === 2033);
  const displayItems = majorItems.length > 0 ? majorItems : items.slice(0, 15);

  dom.buildTimeline.innerHTML = `
    <div class="build-scroll">
      ${displayItems.map((i) => `
        <div class="build-item">
          <img class="build-item-icon" src="https://ddragon.leagueoflegends.com/cdn/${itemCdnVersion(sample)}/img/item/${i.itemId}.png"
               alt="item ${i.itemId}" onerror="this.style.display='none'" width="32" height="32" />
          <span class="build-item-time">${i.timeLabel}</span>
        </div>
      `).join('<span class="build-arrow">→</span>')}
    </div>
  `;
}

function renderObjectiveTimeline(sample) {
  const timeline = sample.normalized?.objectiveTimeline;
  if (!timeline || timeline.length === 0) {
    dom.objectiveSummary.innerHTML = "";
    dom.objectiveTable.innerHTML = '<p class="muted">이 샘플에는 오브젝트 타임라인 데이터가 없습니다.</p>';
    return;
  }

  const allyStructures = timeline.filter((e) => e.type === "STRUCTURE" && e.team === "ALLY").length;
  const enemyStructures = timeline.filter((e) => e.type === "STRUCTURE" && e.team === "ENEMY").length;
  const allyObjectives = timeline.filter((e) => e.type === "OBJECTIVE" && e.team === "ALLY").length;
  const enemyObjectives = timeline.filter((e) => e.type === "OBJECTIVE" && e.team === "ENEMY").length;
  const totalStructures = allyStructures + enemyStructures || 1;

  dom.objectiveSummary.innerHTML = `
    <div class="obj-summary-row">
      <span class="obj-summary-label">아군 타워 <strong>${allyStructures}</strong></span>
      <div class="obj-summary-track">
        <div class="obj-summary-fill obj-summary-fill--ally" style="width: ${(allyStructures / totalStructures) * 100}%"></div>
        <div class="obj-summary-fill obj-summary-fill--enemy" style="width: ${(enemyStructures / totalStructures) * 100}%"></div>
      </div>
      <span class="obj-summary-label">적 타워 <strong>${enemyStructures}</strong></span>
    </div>
    <div class="obj-summary-meta">
      <span>아군 오브젝트: ${allyObjectives}</span>
      <span>적 오브젝트: ${enemyObjectives}</span>
    </div>
  `;

  const laneLabel = { TOP_LANE: "탑", MID_LANE: "미드", BOT_LANE: "봇" };
  const phaseLabel = { EARLY: "초반", MID: "중반", LATE: "후반" };

  let lastPhase = "";
  const rows = timeline.map((e) => {
    const phaseDivider = e.phase !== lastPhase ? `<tr class="obj-phase-divider"><td colspan="6">${phaseLabel[e.phase] || e.phase} (${e.phase})</td></tr>` : "";
    lastPhase = e.phase;
    const teamClass = e.team === "ALLY" ? "obj-row--ally" : "obj-row--enemy";
    const teamText = e.team === "ALLY" ? "아군" : "적";
    const typeIcon = e.type === "STRUCTURE" ? "🏛" : "🐉";
    return `${phaseDivider}
      <tr class="${teamClass}">
        <td>${e.timeLabel}</td>
        <td>${phaseLabel[e.phase] || e.phase}</td>
        <td>${typeIcon} ${e.type === "STRUCTURE" ? "구조물" : "오브젝트"}</td>
        <td>${e.label}</td>
        <td>${laneLabel[e.lane] || e.lane || "—"}</td>
        <td class="obj-team-cell" data-team="${e.team}">${teamText}</td>
      </tr>`;
  }).join("");

  dom.objectiveTable.innerHTML = `
    <table class="obj-table">
      <thead>
        <tr><th>시간</th><th>구간</th><th>유형</th><th>상세</th><th>레인</th><th>팀</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderKdaTimeline(sample) {
  const points = sample.normalized?.kdaTimeline;
  if (!points || points.length <= 1) {
    dom.kdaChart.innerHTML = "";
    dom.kdaEvents.innerHTML = '<p class="muted">KDA 타임라인 데이터가 없습니다.</p>';
    return;
  }

  // KDA 수치 바 차트 (SVG)
  const maxKda = Math.max(...points.map((p) => p.kda), 1);
  const barWidth = Math.max(28, Math.floor(600 / points.length));
  const svgW = barWidth * points.length + 20;
  const svgH = 120;

  const bars = points.map((p, i) => {
    const h = Math.round((p.kda / maxKda) * (svgH - 30));
    const x = i * barWidth + 10;
    const color = p.eventType === "PLAYER_DEATH" ? "var(--rose)" : p.eventType === "CHAMPION_KILL" ? "var(--mint)" : "var(--accent)";
    return `<rect x="${x}" y="${svgH - h - 20}" width="${barWidth - 4}" height="${h}" rx="3" fill="${color}" opacity="0.7"/>
      <text x="${x + (barWidth - 4) / 2}" y="${svgH - h - 24}" text-anchor="middle" fill="var(--text)" font-size="10">${p.kda}</text>
      <text x="${x + (barWidth - 4) / 2}" y="${svgH - 6}" text-anchor="middle" fill="var(--muted)" font-size="9">${p.timeLabel}</text>`;
  }).join("");

  dom.kdaChart.innerHTML = `
    <div class="kda-chart-scroll">
      <svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">${bars}</svg>
    </div>
  `;

  // KDA 변화 이벤트 리스트
  const eventTypeLabel = {
    PLAYER_DEATH: "데스",
    CHAMPION_KILL: "킬",
    TEAMFIGHT_FOLLOWUP: "어시스트",
    SKIRMISH_WIN: "어시스트",
  };

  dom.kdaEvents.innerHTML = points.slice(1).map((p) => {
    const typeClass = p.eventType === "PLAYER_DEATH" ? "kda-evt--death" : "kda-evt--kill";
    return `
      <div class="kda-evt ${typeClass}">
        <span class="kda-evt-time">${p.timeLabel}</span>
        <span class="kda-evt-type">${eventTypeLabel[p.eventType] || p.eventType}</span>
        <span class="kda-evt-kda">${p.kills}/${p.deaths}/${p.assists} (${p.kda})</span>
        <span class="kda-evt-desc">${p.event}</span>
      </div>
    `;
  }).join("");
}

function renderComparison(sample) {
  const comp = sample.comparison?.comparison;
  if (!comp) {
    dom.comparisonStatus.textContent = "이 샘플에는 AI 비교 분석 데이터가 없습니다.";
    dom.comparisonOverview.innerHTML = "";
    dom.comparisonGrid.innerHTML = "";
    return;
  }
  dom.comparisonStatus.textContent = "";

  const rate = comp.agreementRate ?? 0;
  dom.comparisonOverview.innerHTML = `
    <div class="comparison-rate-bar">
      <div class="comparison-rate-label">
        <span>동의율</span>
        <strong>${rate}%</strong>
      </div>
      <div class="comparison-rate-track">
        <div class="comparison-rate-fill" style="width: ${rate}%"></div>
      </div>
      <div class="comparison-rate-meta">
        <span>동의 ${comp.agreements.length}건</span>
        <span>Claude ${comp.claudeOnly.length}건</span>
        <span>Codex ${comp.codexOnly.length}건</span>
      </div>
    </div>
  `;

  function categoryBadge(cat) {
    return cat === "strength"
      ? '<span class="comparison-badge comparison-badge--strength">강점</span>'
      : '<span class="comparison-badge comparison-badge--weakness">약점</span>';
  }

  const agreementCards = comp.agreements.map((a) => `
    <article class="comparison-card" data-source="agree">
      ${categoryBadge(a.category)}
      <h4>${a.topic}</h4>
      <div class="comparison-notes">
        <p><strong>Claude:</strong> ${a.claudeNote}</p>
        <p><strong>Codex:</strong> ${a.codexNote}</p>
      </div>
    </article>
  `).join("");

  const claudeCards = comp.claudeOnly.map((c) => `
    <article class="comparison-card" data-source="claude">
      ${categoryBadge(c.category)}
      <h4>${c.topic}</h4>
      <p>${c.note}</p>
    </article>
  `).join("");

  const codexCards = comp.codexOnly.map((c) => `
    <article class="comparison-card" data-source="codex">
      ${categoryBadge(c.category)}
      <h4>${c.topic}</h4>
      <p>${c.note}</p>
    </article>
  `).join("");

  dom.comparisonGrid.innerHTML = `
    <div class="comparison-column">
      <h3 class="comparison-column-title comparison-column-title--agree">양쪽 동의</h3>
      ${agreementCards || '<p class="muted">동의 항목 없음</p>'}
    </div>
    <div class="comparison-column">
      <h3 class="comparison-column-title comparison-column-title--claude">Claude만</h3>
      ${claudeCards || '<p class="muted">없음</p>'}
    </div>
    <div class="comparison-column">
      <h3 class="comparison-column-title comparison-column-title--codex">Codex만</h3>
      ${codexCards || '<p class="muted">없음</p>'}
    </div>
  `;
}

function renderSample(sample) {
  state.currentSampleId = sample.sampleId || state.currentSampleId;
  state.currentSample = sample;

  // 방어: analysis 객체 기본값 보장
  if (!sample.analysis) sample.analysis = {};
  if (!sample.analysis.coachSummary) sample.analysis.coachSummary = {};
  if (!sample.analysis.matchSummary) sample.analysis.matchSummary = {};

  renderHero(sample);
  renderStats(sample);
  renderPhases(sample);

  // 배열 필드 가드
  const strengths = Array.isArray(sample.analysis.strengths) ? sample.analysis.strengths : [];
  const weaknesses = Array.isArray(sample.analysis.weaknesses) ? sample.analysis.weaknesses : [];
  renderInsightCards(dom.strengths, strengths, "strength", sample);
  renderInsightCards(dom.weaknesses, weaknesses, "weakness", sample);

  if (Array.isArray(sample.analysis.actionChecklist) && sample.analysis.actionChecklist.length > 0) {
    renderChecklist(sample);
  } else {
    dom.checklist.innerHTML = '<li class="muted">체크리스트 데이터 생성 중...</li>';
  }

  if (Array.isArray(sample.analysis.keyMoments) && sample.analysis.keyMoments.length > 0) {
    renderKeyMoments(sample);
  } else {
    dom.keyMoments.innerHTML = '<p class="muted">핵심 장면 데이터 생성 중...</p>';
  }

  renderEvidence(sample);
  renderComparison(sample);
  renderPlaytimeScore(sample);
  renderLaningStats(sample);
  renderDualTimeline(sample);
  renderObjectiveTimeline(sample);
  renderKdaTimeline(sample);
  renderWardTimeline(sample);
  renderBuildTimeline(sample);
  renderSampleSwitcher();
}

async function selectSample(sampleId) {
  state.currentSampleId = sampleId;
  dom.fetchStatus.textContent = `${sampleId} 데이터를 불러오는 중입니다.`;

  try {
    state.manifest = (await fetchJson("/api/samples")).samples;
    const sample = await loadSampleBundle(sampleId);
    const match = sampleMatchSummary(sample);
    renderSample(sample);
    dom.fetchStatus.textContent = `${sampleId} 로드 완료 · ${[match.champion, match.role, match.result ? resultLabel(match.result) : "결과 미상"].filter(Boolean).join(" ")}`;
  } catch (error) {
    dom.fetchStatus.innerHTML = `샘플 로드 실패: ${error.message} <button class="retry-btn" data-retry-sample="${sampleId}">다시 시도</button>`;
  }
}

function renderCandidates(matches) {
  dom.candidateList.innerHTML = matches
    .map(
      (match) => `
        <button class="match-row" type="button" data-generate-match="${match.matchId}" data-result="${match.result}" aria-pressed="false">
          <span class="match-row__icon">${championAvatarMarkup(match.champion, "medium")}</span>
          <div class="match-row__main">
            <div class="match-row__title">
              <strong class="match-row__champion">${championDisplayName(match.champion)}</strong>
              <span class="match-row__role">${match.role || ""}</span>
              <span class="match-row__queue">${compactQueueLabel(match.queueType) || ""}</span>
              <span class="match-row__patch">${matchPatchLabel(match.gameVersion) || ""}</span>
            </div>
            <div class="match-row__stats">
              <span class="match-row__kda">${match.kills}/${match.deaths}/${match.assists}</span>
              <span class="match-row__duration">${match.durationLabel || ""}</span>
              <span class="match-row__cs">${buildCandidateCardSummary(match)}</span>
            </div>
          </div>
          <span class="match-row__result" data-result="${match.result}">${resultLabel(match.result)}</span>
        </button>
      `,
    )
    .join("");
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

function findSampleIdForMatch(matchId) {
  const sample = (state.manifest || []).find((entry) => inferMatchIdFromSampleEntry(entry) === matchId);
  return sample ? sample.id : null;
}

function syncRecentFormWithAccount() {
  if (!state.account) return;
  dom.recentForm.querySelector("[name=gameName]").value = state.account.gameName || "";
  dom.recentForm.querySelector("[name=tagLine]").value = state.account.tagLine || "";
  dom.recentForm.querySelector("[name=platformRegion]").value = state.account.platformRegion || "KR";
}

function formatRetryMessage(error) {
  const baseMessage = String(error?.message || "알 수 없는 오류가 발생했습니다.").trim();
  if (baseMessage.includes("다시 시도") || baseMessage.includes("잠시 후")) {
    return baseMessage;
  }
  return `${baseMessage} 잠시 후 다시 시도하세요.`;
}

function toggleDisabled(elements, disabled) {
  elements.filter(Boolean).forEach((element) => {
    element.disabled = disabled;
  });
}

function applyPendingUi() {
  const loginDisabled = Boolean(state.isLoginPending);
  const recentDisabled = Boolean(state.isRecentMatchesPending || state.isGeneratePending || state.isDetailPending);
  const detailDisabled = Boolean(state.isDetailPending || state.isGeneratePending);

  toggleDisabled(Array.from(dom.loginForm.querySelectorAll("input, select, button")), loginDisabled);
  toggleDisabled(Array.from(dom.recentForm.querySelectorAll("input, select, button")), recentDisabled);
  toggleDisabled(Array.from(dom.candidateList.querySelectorAll("[data-generate-match]")), recentDisabled);
  toggleDisabled(Array.from(dom.sampleSwitcher.querySelectorAll("[data-sample-button]")), recentDisabled);
  toggleDisabled(Array.from(dom.matchListGrid.querySelectorAll("[data-match-detail]")), detailDisabled);
  toggleDisabled(Array.from(dom.matchListHeader.querySelectorAll("button")), detailDisabled);
  toggleDisabled([dom.backToListBtn], detailDisabled);
}

async function handleRecentMatchesSubmit(event) {
  event.preventDefault();
  if (state.isRecentMatchesPending || state.isGeneratePending || state.isDetailPending) return;

  const formData = new FormData(dom.recentForm);
  const gameName = (formData.get("gameName") || "").trim();
  const tagLine = (formData.get("tagLine") || "").trim();

  if (gameName.length < 3 || gameName.length > 16) {
    dom.fetchStatus.textContent = "gameName은 3~16자여야 합니다.";
    return;
  }
  if (tagLine.length < 2 || tagLine.length > 5 || !/^[a-zA-Z0-9]+$/.test(tagLine)) {
    dom.fetchStatus.textContent = "tagLine은 2~5자 영문/숫자만 허용됩니다.";
    return;
  }

  const payload = {
    gameName,
    tagLine,
    platformRegion: formData.get("platformRegion"),
    matchCount: 5,
  };

  state.isRecentMatchesPending = true;
  applyPendingUi();
  dom.fetchStatus.textContent = `${payload.gameName}#${payload.tagLine} 최근 경기 후보를 불러오는 중입니다.`;

  try {
    const result = await fetchJson("/api/recent-matches", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    renderCandidates(result.matches || []);
    applyPendingUi();
    dom.fetchStatus.textContent = `${result.riotId} 최근 경기 ${result.matches.length}건을 불러왔습니다. fit 점수가 높은 순서대로 정렬했습니다.`;
  } catch (error) {
    dom.fetchStatus.innerHTML = `최근 경기 조회 실패: ${formatRetryMessage(error)} <button class="retry-btn" data-retry-recent>다시 시도</button>`;
  } finally {
    state.isRecentMatchesPending = false;
    applyPendingUi();
  }
}

async function handleGenerateSample(matchId) {
  if (state.isGeneratePending) {
    throw new Error("샘플 생성이 이미 진행 중입니다. 잠시 후 다시 시도하세요.");
  }

  const gameName = dom.recentForm.querySelector("[name=gameName]")?.value || "";
  const tagLine = dom.recentForm.querySelector("[name=tagLine]")?.value || "";
  const platformRegion = dom.recentForm.querySelector("[name=platformRegion]")?.value || "KR";
  const payload = {
    gameName: gameName.trim(),
    tagLine: tagLine.trim(),
    platformRegion: platformRegion.trim(),
    matchId,
  };
  if (getUserApiKey()) payload.riotApiKey = getUserApiKey();

  state.isGeneratePending = true;
  applyPendingUi();
  dom.fetchStatus.textContent = `${matchId} 기준으로 새 샘플을 생성하는 중입니다.`;

  try {
    const result = await fetchJson("/api/generate-sample", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    try {
      state.manifest = await loadManifest();
    } catch {}

    dom.fetchStatus.textContent = `${result.sampleId} 생성 완료 · ${result.analysis.matchSummary.champion} ${result.analysis.matchSummary.role} ${result.analysis.matchSummary.result}`;
    return result;
  } catch (error) {
    dom.fetchStatus.textContent = `샘플 생성 실패: ${formatRetryMessage(error)}`;
    throw error;
  } finally {
    state.isGeneratePending = false;
    applyPendingUi();
  }
}

// ─── Login handler ────────────────────────────────────────────────────────

async function handleLogin(event) {
  if (event) event.preventDefault();
  if (state.isLoginPending) return;

  const form = new FormData(dom.loginForm);
  const account = {
    gameName: (form.get("gameName") || "").trim(),
    tagLine: (form.get("tagLine") || "").trim(),
    platformRegion: form.get("platformRegion") || "KR",
  };
  const remember = form.get("remember");
  const userApiKey = (form.get("riotApiKey") || "").trim();

  if (account.gameName.length < 3 || account.tagLine.length < 2) {
    dom.loginStatus.textContent = "gameName(3자 이상)과 tagLine(2자 이상)을 입력하세요.";
    return;
  }

  // API 키 저장
  state.riotApiKey = userApiKey;
  if (remember) saveApiKey(userApiKey);

  state.isLoginPending = true;
  applyPendingUi();
  setView("LOADING_MATCHES");
  dom.loginStatus.textContent = `${account.gameName}#${account.tagLine} 조회 중...`;
  queueChampionVersionLoad(); // DDragon 버전/에셋을 API 호출과 병렬로 준비

  try {
    const payload = { ...account, matchCount: 10 };
    if (userApiKey) payload.riotApiKey = userApiKey;

    const result = await fetchJson("/api/recent-matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    state.account = {
      ...account,
      riotId: result.riotId,
      puuid: result.puuid,
      summonerLevel: result.summonerLevel,
      profileIconId: result.profileIconId,
      ranked: result.ranked,
      rankedStatus: result.rankedStatus,
      rankedError: result.rankedError,
      championMastery: result.championMastery || [],
    };
    state.recentMatches = result.matches || [];
    state.recentMatchesHasMore = Boolean(result.hasMore);
    if (remember) saveAccount(account);

    renderMatchList();
    setView("MATCH_LIST");
    prefetchAndAnalyzeAll();  // fire-and-forget: 기존 프리페치 + 미분석 자동 생성
  } catch (error) {
    dom.loginStatus.textContent = `조회 실패: ${formatRetryMessage(error)}`;
    setView("LOGGED_OUT");
  } finally {
    state.isLoginPending = false;
    applyPendingUi();
  }
}

// ─── 10-game match list ───────────────────────────────────────────────────

function renderMatchList() {
  const matches = state.recentMatches;
  const acct = state.account;

  // ── 프로필 통계 계산 ──
  const wins = matches.filter((m) => m.result === "WIN").length;
  const losses = matches.length - wins;
  const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0;

  const avgKills = matches.length > 0 ? (matches.reduce((s, m) => s + (m.kills || 0), 0) / matches.length).toFixed(1) : "0";
  const avgDeaths = matches.length > 0 ? (matches.reduce((s, m) => s + (m.deaths || 0), 0) / matches.length).toFixed(1) : "0";
  const avgAssists = matches.length > 0 ? (matches.reduce((s, m) => s + (m.assists || 0), 0) / matches.length).toFixed(1) : "0";

  // 역할 분포
  const roleCounts = {};
  matches.forEach((m) => { roleCounts[m.role] = (roleCounts[m.role] || 0) + 1; });
  const roleEntries = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]);

  // 상위 마스터리 챔피언
  const mastery = acct.championMastery || [];
  const topMastery = mastery.slice(0, 5).map((m) => ({
    name: championNameFromId(m.championId),
    level: m.championLevel,
    points: m.championPoints,
  })).filter((m) => m.name);

  // 프로필 아이콘 URL
  const iconUrl = profileIconUrl(acct.profileIconId);

  // 랭크 정보
  const ranked = normalizeRankedSnapshot(acct.ranked);
  const tierColors = {
    iron: "#8b8b8b", bronze: "#b5733a", silver: "#8e9aaa", gold: "#f0b35b",
    platinum: "#4ba6a6", emerald: "#2ea66b", diamond: "#6b7fe8",
    master: "#b46bda", grandmaster: "#e04e4e", challenger: "#f0c74e",
  };
  const tierColor = ranked ? (tierColors[(ranked.tier || "").toLowerCase()] || "var(--muted)") : "var(--muted)";

  dom.matchListHeader.innerHTML = `
    <div class="profile-header">
      <div class="profile-header__top">
        <div class="profile-identity">
          ${iconUrl
            ? `<img class="profile-icon" src="${iconUrl}" alt="프로필 아이콘" onerror="this.style.display='none'" />`
            : `<div class="profile-icon profile-icon--fallback">${(acct.riotId || acct.gameName || "?")[0]}</div>`
          }
          <div class="profile-identity__text">
            <h2 class="profile-name">${escapeHtml(acct.riotId || `${acct.gameName}#${acct.tagLine}`)}</h2>
            ${acct.summonerLevel ? `<span class="level-badge">Lv. ${acct.summonerLevel}</span>` : ""}
          </div>
        </div>
        <button class="login-submit login-submit--small" data-logout-btn>다른 계정</button>
      </div>

      <div class="profile-header__body">
        ${ranked ? `
          <div class="profile-rank-card" style="--tier-color: ${tierColor}">
            <div class="profile-rank-card__tier">
              <span class="tier-emblem">${escapeHtml(rankedEmblemLabel(ranked))}</span>
              <div>
                <span class="tier-queue">${escapeHtml(ranked.queueLabel)}</span>
                <strong class="tier-name">${escapeHtml(rankedDisplayName(ranked))}</strong>
                <span class="tier-lp">${ranked.lp} LP</span>
              </div>
            </div>
            <div class="profile-rank-card__record">
              <span>${ranked.wins}승 ${ranked.losses}패</span>
              <span class="tier-winrate">승률 ${ranked.winRate}%</span>
            </div>
          </div>
        ` : acct.rankedStatus === "error" ? `
          <div class="profile-rank-card profile-rank-card--na">
            <span class="muted">랭크 조회 실패</span>
          </div>
        ` : `
          <div class="profile-rank-card profile-rank-card--na">
            <span class="muted">랭크 기록 없음</span>
          </div>
        `}

        <div class="profile-stats-block">
          <div class="profile-winrate">
            <div class="winrate-ring" style="--wr: ${winRate}">
              <span>${winRate}%</span>
            </div>
            <div class="winrate-detail">
              <span class="winrate-record">${wins}승 ${losses}패</span>
              <span class="muted">최근 ${matches.length}게임</span>
            </div>
          </div>
          <div class="profile-avg-kda">
            <span class="meta-label">평균 KDA</span>
            <strong>${avgKills} / <span class="kda-death">${avgDeaths}</span> / ${avgAssists}</strong>
          </div>
        </div>

        <div class="profile-roles">
          <span class="meta-label">플레이 역할</span>
          <div class="role-bar-list">
            ${roleEntries.map(([role, count]) => `
              <div class="role-bar-item">
                <span class="role-bar-label">${role}</span>
                <div class="role-bar-track">
                  <div class="role-bar-fill" style="width: ${Math.round((count / matches.length) * 100)}%"></div>
                </div>
                <span class="role-bar-count">${count}</span>
              </div>
            `).join("")}
          </div>
        </div>

        ${topMastery.length > 0 ? `
          <div class="profile-mastery">
            <span class="meta-label">숙련도 Top</span>
            <div class="mastery-chip-list">
              ${topMastery.map((m) => {
                const squareUrl = championSquareUrl(m.name);
                return `
                  <div class="mastery-chip">
                    ${squareUrl ? `<img src="${squareUrl}" alt="${championDisplayName(m.name)}" />` : `<span class="mastery-chip__icon">${championMonogram(m.name)}</span>`}
                    <div class="mastery-chip__text">
                      <strong>${championDisplayName(m.name)}</strong>
                      <span>M${m.level} · ${formatMasteryPoints(m.points)}</span>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        ` : ""}
      </div>
    </div>
  `;

  dom.matchListGrid.innerHTML = matches.map((m) => {
    const masteryInfo = findMasteryForChampion(m.champion);
    const masteryBadge = masteryInfo
      ? `<span class="msc-mastery">M${masteryInfo.championLevel}</span>`
      : "";
    const kdaRatio = m.deaths > 0 ? ((m.kills + m.assists) / m.deaths).toFixed(2) : "Perfect";
    const patchLabel = matchPatchLabel(m.gameVersion);

    return `
      <button class="match-summary-card" data-match-detail="${m.matchId}" data-result="${m.result}">
        <div class="msc-result-bar" data-result="${m.result}"></div>
        <div class="msc-row1">
          <div class="match-summary-champion">
            ${championAvatarMarkup(m.champion, "small")}
            <div>
              <strong>${championDisplayName(m.champion)}</strong>
              <span class="meta-label">${m.role} ${masteryBadge}</span>
            </div>
          </div>
          <div class="msc-kda-block">
            <span class="match-summary-kda"><span>${m.kills}</span>/<span class="kda-death">${m.deaths}</span>/<span>${m.assists}</span></span>
            <span class="msc-kda-ratio">${kdaRatio}${kdaRatio !== "Perfect" ? ":1" : ""}</span>
          </div>
          <span class="match-summary-result" data-result="${m.result}">${resultLabel(m.result)}</span>
        </div>
        <div class="msc-row2">
          <span class="match-summary-cs">${m.csPerMin} CS/m</span>
          <span class="match-summary-duration">${m.durationLabel}</span>
          <span class="match-summary-queue">${compactQueueLabel(m.queueLabel)}</span>
          <span class="match-summary-patch">${patchLabel}</span>
          <span class="match-summary-time">${timeAgo(m.timestamp)}</span>
        </div>
      </button>
    `;
  }).join("");

  renderMatchListFooter();
  applyPendingUi();
}

function renderMatchListFooter() {
  const footer = dom.matchListFooter;
  if (!footer) return;
  if (!state.recentMatchesHasMore) {
    footer.innerHTML = "";
    return;
  }
  const loading = state.isLoadMorePending;
  footer.innerHTML = `
    <button type="button" class="match-list-more-btn" data-match-more ${loading ? "disabled" : ""}>
      ${loading ? "불러오는 중..." : `이전 경기 10개 더 보기 <span class="match-list-more-btn__hint">현재 ${state.recentMatches.length}개</span>`}
    </button>
  `;
}

async function loadMoreRecentMatches() {
  if (state.isLoadMorePending || !state.recentMatchesHasMore) return;
  const acct = state.account;
  if (!acct) return;

  state.isLoadMorePending = true;
  renderMatchListFooter();

  try {
    const payload = {
      gameName: acct.gameName,
      tagLine: acct.tagLine,
      platformRegion: acct.platformRegion || "KR",
      matchCount: 10,
      start: state.recentMatches.length,
    };
    const userApiKey = getUserApiKey();
    if (userApiKey) payload.riotApiKey = userApiKey;

    const result = await fetchJson("/api/recent-matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const incoming = result.matches || [];
    const existing = new Set(state.recentMatches.map((m) => m.matchId));
    const fresh = incoming.filter((m) => !existing.has(m.matchId));
    state.recentMatches = [...state.recentMatches, ...fresh];
    state.recentMatchesHasMore = Boolean(result.hasMore) && fresh.length > 0;

    renderMatchList();
    prefetchAndAnalyzeAll();
  } catch (error) {
    state.recentMatchesHasMore = true;
    renderMatchListFooter();
    alert(`이전 경기 불러오기 실패: ${formatRetryMessage(error)}`);
  } finally {
    state.isLoadMorePending = false;
  }
}

// ─── Background analysis queue ────────────────────────────────────────────

function updateCardBadge(matchId, text, cssClass) {
  const card = dom.matchListGrid.querySelector(`[data-match-detail="${matchId}"]`);
  if (!card) return;
  let badge = card.querySelector(".analyzed-badge");
  if (!badge) {
    card.insertAdjacentHTML("beforeend", `<span class="analyzed-badge ${cssClass}">${text}</span>`);
  } else {
    badge.textContent = text;
    badge.className = `analyzed-badge ${cssClass}`;
  }
}

async function prefetchAndAnalyzeAll() {
  state.prefetchedSamples = new Map();

  // 저장된 샘플만 프리페치
  for (const match of state.recentMatches) {
    const sampleId = findSampleIdForMatch(match.matchId);
    if (sampleId) {
      try {
        const bundle = await loadSampleBundle(sampleId);
        state.prefetchedSamples.set(match.matchId, bundle);
        updateCardBadge(match.matchId, "분석 완료", "badge--done");
      } catch {}
    }
  }
}

// ─── Detail analysis from match list ──────────────────────────────────────

async function startDetailAnalysis(matchId) {
  if (state.isDetailPending) return;

  state.isDetailPending = true;
  setDetailProgress("prepare", {
    message: `${matchId} 상세 분석을 준비하고 있습니다.`,
    progress: 8,
  });
  applyPendingUi();
  setView("LOADING_DETAIL");
  syncRecentFormWithAccount();

  try {
    setDetailProgress("lookup", {
      message: "이미 저장된 분석이 있는지 확인하고 있습니다.",
      progress: 24,
    });

    // 1. 프리페치 캐시 확인 (즉시 렌더)
    const prefetched = state.prefetchedSamples?.get(matchId);
    if (prefetched) {
      const match = sampleMatchSummary(prefetched);
      state.currentSampleId = prefetched.sampleId || findSampleIdForMatch(matchId) || state.currentSampleId;
      setDetailProgress("compose", {
        message: "저장된 분석으로 리포트를 구성하고 있습니다.",
        progress: 88,
        skippedSteps: ["riot", "ai"],
      });
      renderSample(prefetched);
      dom.fetchStatus.textContent = `${state.currentSampleId || matchId} 로드 완료 · ${[match.champion, match.role, match.result ? resultLabel(match.result) : "결과 미상"].filter(Boolean).join(" ")}`;
      setView("DETAIL_VIEW");
      completeDetailProgress("저장된 분석 리포트를 열었습니다.");
      return;
    }

    // 2. manifest에서 기존 샘플 확인
    const cachedSampleId = findSampleIdForMatch(matchId);

    if (cachedSampleId) {
      setDetailProgress("compose", {
        message: `${cachedSampleId} 저장 분석을 불러와 리포트를 구성하고 있습니다.`,
        progress: 88,
        skippedSteps: ["riot", "ai"],
      });
      dom.fetchStatus.textContent = `${matchId} 저장된 분석을 여는 중입니다.`;
      await selectSample(cachedSampleId);
      setView("DETAIL_VIEW");
      completeDetailProgress("저장된 분석 리포트를 열었습니다.");
      return;
    }

    // 3. 직접 생성
    setDetailProgress("riot", {
      message: "Riot 매치 데이터와 타임라인을 확인하고 있습니다.",
      progress: 42,
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    startSoftDetailProgress("ai", `${matchId} AI 분석을 생성하고 있습니다. 보통 2~5분 정도 걸릴 수 있습니다.`, {
      progress: 64,
    });
    dom.fetchStatus.textContent = `${matchId} AI 분석 진행 중... (2~5분 소요)`;
    const result = await handleGenerateSample(matchId);
    setDetailProgress("compose", {
      message: `${result.sampleId} 샘플을 저장하고 리포트를 구성하고 있습니다.`,
      progress: 92,
    });
    await selectSample(result.sampleId);
    setView("DETAIL_VIEW");
    completeDetailProgress("새 분석 리포트를 열었습니다.");
  } catch (error) {
    dom.fetchStatus.textContent = `상세 분석 열기 실패: ${formatRetryMessage(error)}`;
    failDetailProgress(formatRetryMessage(error));
    setView("MATCH_LIST");
  } finally {
    state.isDetailPending = false;
    applyPendingUi();
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────

async function init() {
  // manifest 로드 (실패해도 계속 진행)
  try {
    state.manifest = await loadManifest();
  } catch {}

  // 이벤트 리스너 등록
  dom.loginForm.addEventListener("submit", handleLogin);
  dom.recentForm.addEventListener("submit", handleRecentMatchesSubmit);

  dom.sampleSwitcher.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sample-button]");
    if (!button) return;
    selectSample(button.dataset.sampleButton);
  });

  if (dom.reportStrip) {
    dom.reportStrip.addEventListener("click", (event) => {
      const button = event.target.closest("[data-sample-button]");
      if (!button) return;
      selectSample(button.dataset.sampleButton);
    });
  }

  dom.candidateList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-generate-match]");
    if (!button) return;
    handleGenerateSample(button.dataset.generateMatch)
      .then((result) => selectSample(result.sampleId))
      .then(() => {
        setView("DETAIL_VIEW");
      })
      .catch(() => {});
  });

  dom.matchListGrid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-match-detail]");
    if (!card) return;
    startDetailAnalysis(card.dataset.matchDetail);
  });

  if (dom.matchListFooter) {
    dom.matchListFooter.addEventListener("click", (event) => {
      if (event.target.closest("[data-match-more]")) {
        loadMoreRecentMatches();
      }
    });
  }

  dom.backToListBtn.addEventListener("click", () => setView("MATCH_LIST"));

  dom.matchListHeader.addEventListener("click", (event) => {
    if (event.target.closest("[data-logout-btn]")) {
      localStorage.removeItem("lol-coach-account");
      state.account = null;
      state.recentMatches = [];
      state.recentMatchesHasMore = false;
      setView("LOGGED_OUT");
    }
  });

  document.addEventListener("click", (event) => {
    const retrySample = event.target.closest("[data-retry-sample]");
    if (retrySample) {
      selectSample(retrySample.dataset.retrySample);
      return;
    }
    const retryRecent = event.target.closest("[data-retry-recent]");
    if (retryRecent) {
      dom.recentForm.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });

  // 저장된 계정 확인 → 자동 로그인 또는 로그인 화면
  // 저장된 API 키 복원
  const savedApiKey = loadSavedApiKey();
  if (savedApiKey) {
    state.riotApiKey = savedApiKey;
    const apiKeyInput = dom.loginForm.querySelector("[name=riotApiKey]");
    if (apiKeyInput) apiKeyInput.value = savedApiKey;
  }

  const saved = loadSavedAccount();
  if (saved) {
    dom.loginForm.querySelector("[name=gameName]").value = saved.gameName;
    dom.loginForm.querySelector("[name=tagLine]").value = saved.tagLine;
    if (saved.platformRegion) dom.loginForm.querySelector("[name=platformRegion]").value = saved.platformRegion;
    handleLogin();
  } else {
    setView("LOGGED_OUT");
  }

  applyPendingUi();
  initTabSystem();
  bindDualTimelineEvents();
}

// ─── Tab system ─────────────────────────────────────────────────────────

function switchTab(tabId) {
  const dashboard = document.getElementById("main-content");
  if (!dashboard) return;

  // Update tab-bar buttons
  dashboard.querySelectorAll(".tab-btn").forEach((btn) => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle("tab-btn--active", isActive);
    btn.setAttribute("aria-selected", isActive);
  });

  // Update tab pages
  dashboard.querySelectorAll(".tab-page").forEach((page) => {
    page.classList.toggle("tab-page--active", page.id === tabId);
  });

  dashboard.dataset.activeTab = tabId;
  localStorage.setItem("lol-coach-active-tab", tabId);
}

function initTabSystem() {
  // Tab bar click handler
  if (dom.tabBar) {
    dom.tabBar.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (btn && btn.dataset.tab) switchTab(btn.dataset.tab);
    });
  }

  // Restore last active tab
  const savedTab = localStorage.getItem("lol-coach-active-tab");
  if (savedTab && document.getElementById(savedTab)) {
    switchTab(savedTab);
  }

  // Collapsible card handlers
  document.querySelectorAll("[data-collapse-toggle]").forEach((heading) => {
    heading.addEventListener("click", () => {
      const card = heading.closest("[data-card-id]");
      if (!card) return;
      const id = card.dataset.cardId;
      const isCollapsed = card.hasAttribute("data-collapsed");
      if (isCollapsed) {
        card.removeAttribute("data-collapsed");
      } else {
        card.setAttribute("data-collapsed", "");
      }
      // Persist
      const store = JSON.parse(localStorage.getItem("lol-coach-collapsed") || "{}");
      if (isCollapsed) { delete store[id]; } else { store[id] = true; }
      localStorage.setItem("lol-coach-collapsed", JSON.stringify(store));
    });
  });

  // Restore collapsed states
  const collapsed = JSON.parse(localStorage.getItem("lol-coach-collapsed") || "{}");
  Object.keys(collapsed).forEach((id) => {
    const card = document.querySelector(`[data-card-id="${id}"]`);
    if (card) card.setAttribute("data-collapsed", "");
  });
}

init();
