const dom = {
  sampleId: document.querySelector("[data-sample-id]"),
  heroPlayer: document.querySelector("[data-hero-player]"),
  heroMatch: document.querySelector("[data-hero-match]"),
  heroDate: document.querySelector("[data-hero-date]"),
  themeCopy: document.querySelector("[data-theme-copy]"),
  heroPills: document.querySelector("[data-hero-pills]"),
  headline: document.querySelector("[data-headline]"),
  overallSummary: document.querySelector("[data-overall-summary]"),
  gameFlowSummary: document.querySelector("[data-game-flow-summary]"),
  resultPill: document.querySelector("[data-result-pill]"),
  snapshotChampion: document.querySelector("[data-snapshot-champion]"),
  snapshotChampionIcon: document.querySelector("[data-snapshot-champion-icon]"),
  snapshotRole: document.querySelector("[data-snapshot-role]"),
  snapshotResult: document.querySelector("[data-snapshot-result]"),
  snapshotQueue: document.querySelector("[data-snapshot-queue]"),
  snapshotDuration: document.querySelector("[data-snapshot-duration]"),
  snapshotPatch: document.querySelector("[data-snapshot-patch]"),
  snapshotConfidence: document.querySelector("[data-snapshot-confidence]"),
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
};

const state = {
  manifest: [],
  currentSample: null,
  currentSampleId: null,
};

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
      Object.values(payload.data).forEach((champion) => {
        registerChampionAssetKey(nextMap, champion.id, champion.id);
        registerChampionAssetKey(nextMap, champion.name, champion.id);
        registerChampionAssetKey(nextMap, championDisplayName(champion.id), champion.id);
      });

      Object.entries(CHAMPION_ART_ALIASES).forEach(([alias, assetKey]) => {
        registerChampionAssetKey(nextMap, alias, assetKey);
      });

      championAssetMap = nextMap;
      refreshChampionAvatarElements();
    })
    .catch(() => {})
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
    .catch(() => {})
    .finally(() => {
      championCdnVersionPromise = null;
    });
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
  const match = sample.analysis.matchSummary;
  const base = `${match.champion} ${match.role} ${resultLabel(match.result)}`;
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

  return match.headline;
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

    return {
      sampleId: entry.id,
      publicAlias: entry.publicAlias,
      collectedDate: entry.collectedDate,
      theme: entry.theme,
      normalized,
      analysis,
    };
  }
}

function evidenceMap(sample) {
  return new Map(sample.analysis.evidenceIndex.map((entry) => [entry.eventId, entry]));
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
    dom.reportStrip.innerHTML = state.manifest
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
  dom.sampleId.textContent = sample.sampleId;
  dom.heroPlayer.textContent = sample.publicAlias;
  dom.heroMatch.textContent = sample.analysis.matchSummary.matchId;
  dom.heroDate.textContent = sample.collectedDate;
  dom.themeCopy.textContent = sample.theme;

  dom.headline.textContent = buildCompactHeadline(sample);
  dom.headline.title = sample.analysis.matchSummary.headline;
  dom.overallSummary.textContent = sample.analysis.coachSummary.overallSummary;
  dom.gameFlowSummary.textContent = sample.analysis.coachSummary.gameFlowSummary;
  dom.resultPill.dataset.result = sample.analysis.matchSummary.result;
  dom.resultPill.textContent = `${resultLabel(sample.analysis.matchSummary.result)} · ${sample.analysis.coachSummary.winLossReason}`;

  const championName = championDisplayName(sample.analysis.matchSummary.champion);
  dom.snapshotChampion.textContent = championName;
  if (dom.snapshotChampionIcon) {
    dom.snapshotChampionIcon.textContent = "";
    dom.snapshotChampionIcon.dataset.monogram = championMonogram(sample.analysis.matchSummary.champion);
    dom.snapshotChampionIcon.dataset.championName = sample.analysis.matchSummary.champion || "";
    dom.snapshotChampionIcon.title = championName;
    applyChampionAvatarPresentation(dom.snapshotChampionIcon, sample.analysis.matchSummary.champion);
    queueChampionVersionLoad();
  }
  dom.snapshotRole.textContent = sample.analysis.matchSummary.role;
  dom.snapshotResult.textContent = resultLabel(sample.analysis.matchSummary.result);
  dom.snapshotQueue.textContent = compactQueueLabel(sample.analysis.matchSummary.queueType);
  dom.snapshotDuration.textContent = sample.normalized.matchInfo.durationLabel;
  dom.snapshotPatch.textContent = compactPatchLabel(sample.analysis.matchSummary.gameVersion);
  dom.snapshotConfidence.textContent = formatPercent(sample.analysis.analysisMeta.confidence);

  if (dom.heroPills) {
    dom.heroPills.innerHTML = [
      sample.analysis.matchSummary.champion,
      sample.analysis.matchSummary.role,
      resultLabel(sample.analysis.matchSummary.result),
      compactQueueLabel(sample.analysis.matchSummary.queueType),
      compactPatchLabel(sample.analysis.matchSummary.gameVersion),
    ]
      .map((label) => `<span class="hero-pill">${label}</span>`)
      .join("");
  }
}

function renderStats(sample) {
  const stats = [
    {
      label: "KDA",
      value: `${sample.normalized.playerStats.kills}/${sample.normalized.playerStats.deaths}/${sample.normalized.playerStats.assists}`,
      note: `배수 ${sample.normalized.playerStats.kda.toFixed(2)}`,
    },
    {
      label: "CS",
      value: formatNumber(sample.normalized.playerStats.cs),
      note: `분당 ${sample.normalized.playerStats.csPerMinute.toFixed(2)}`,
    },
    {
      label: "Gold",
      value: formatNumber(sample.normalized.playerStats.goldEarned),
      note: "누적 획득 골드",
    },
    {
      label: "Damage",
      value: formatNumber(sample.normalized.playerStats.damageToChampions),
      note: "챔피언 대상 피해",
    },
    {
      label: "Vision",
      value: formatNumber(sample.normalized.playerStats.visionScore),
      note: "시야 점수",
    },
    {
      label: "KP",
      value: formatPercent(sample.normalized.playerStats.killParticipation),
      note: `팀 킬 ${sample.normalized.teamContext.teamTotalKills}`,
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
  dom.phaseGrid.innerHTML = sample.analysis.phaseSummaries
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

      const footer =
        kind === "strength"
          ? `<p class="insight-footer">${item.impact}</p>`
          : `<p class="insight-footer">${item.improvementHint}</p>`;

      return `
        <article class="insight-card" data-kind="${kind}">
          <div class="insight-card__header">
            <h4>${item.title}</h4>
            <span>${kind === "strength" ? "잘한 점" : "개선 포인트"}</span>
          </div>
          <p class="insight-body">${item.description}</p>
          <p class="insight-evidence">${item.evidence}</p>
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
  dom.checklist.innerHTML = sample.analysis.actionChecklist
    .map(
      (item) => `
        <li class="checklist-item">
          <div class="checklist-priority">P${item.priority}</div>
          <div>
            <strong>${item.action}</strong>
            <p>${item.reason}</p>
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
            <span>${moment.timestamp}</span>
            <strong>${moment.phase}</strong>
          </div>
          <div class="moment-copy">
            <h4>${moment.label}</h4>
            <p>${moment.reason}</p>
            <span>${moment.impact}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderEvidence(sample) {
  dom.evidence.innerHTML = sample.analysis.evidenceIndex
    .map(
      (entry) => `
        <article class="evidence-item">
          <div class="evidence-stamp">
            <span>${entry.timestamp}</span>
            <strong>${entry.eventType}</strong>
          </div>
          <div class="evidence-copy">
            <p>${entry.summary}</p>
            <span>${entry.statNote}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderSample(sample) {
  state.currentSample = sample;
  renderHero(sample);
  renderStats(sample);
  renderPhases(sample);
  renderInsightCards(dom.strengths, sample.analysis.strengths, "strength", sample);
  renderInsightCards(dom.weaknesses, sample.analysis.weaknesses, "weakness", sample);
  renderChecklist(sample);
  renderKeyMoments(sample);
  renderEvidence(sample);
  renderSampleSwitcher();
}

async function selectSample(sampleId) {
  state.currentSampleId = sampleId;
  dom.fetchStatus.textContent = `${sampleId} 데이터를 불러오는 중입니다.`;

  try {
    const sample = await loadSampleBundle(sampleId);
    renderSample(sample);
    dom.fetchStatus.textContent = `${sampleId} 로드 완료 · ${sample.analysis.matchSummary.champion} ${sample.analysis.matchSummary.role} ${resultLabel(sample.analysis.matchSummary.result)}`;
  } catch (error) {
    dom.fetchStatus.textContent = `샘플 로드 실패: ${error.message}`;
  }
}

function renderCandidates(matches) {
  dom.candidateList.innerHTML = matches
    .map(
      (match) => `
        <button class="candidate-card candidate-card--button" type="button" data-generate-match="${match.matchId}">
          <div class="candidate-head">
            <div class="champion-inline">
              ${championAvatarMarkup(match.champion, "medium")}
              <div class="candidate-head__copy">
                <span class="meta-label">${match.matchId}</span>
                <h4>${championDisplayName(match.champion)}</h4>
                ${candidateIdentityMetaMarkup(match)}
              </div>
            </div>
            <span class="candidate-fit">fit ${match.sampleFitScore}</span>
          </div>
          <div class="candidate-meta candidate-meta--primary">
            <span>${match.role}</span>
            <span class="candidate-result" data-result="${match.result}">${resultLabel(match.result)}</span>
            <span>${match.durationLabel}</span>
            <span>${match.kills}/${match.deaths}/${match.assists}</span>
          </div>
          <div class="candidate-meta candidate-meta--secondary">
            <span>${buildCandidateCardSummary(match)}</span>
          </div>
          <p>${match.champion} ${match.role} 기준으로 바로 샘플 생성 가능한 경기입니다.</p>
        </button>
      `,
    )
    .join("");
}

async function handleRecentMatchesSubmit(event) {
  event.preventDefault();
  const formData = new FormData(dom.recentForm);
  const payload = {
    gameName: formData.get("gameName"),
    tagLine: formData.get("tagLine"),
    platformRegion: formData.get("platformRegion"),
    matchCount: 5,
  };

  dom.fetchStatus.textContent = `${payload.gameName}#${payload.tagLine} 최근 경기 후보를 불러오는 중입니다.`;
  dom.candidateList.innerHTML = "";

  try {
    const result = await fetchJson("/api/recent-matches", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    renderCandidates(result.matches || []);
    dom.fetchStatus.textContent = `${result.riotId} 최근 경기 ${result.matches.length}건을 불러왔습니다. fit 점수가 높은 순서대로 정렬했습니다.`;
  } catch (error) {
    dom.fetchStatus.textContent = `최근 경기 조회 실패: ${error.message}. server.js를 통해 실행 중인지 확인해 주세요.`;
  }
}

async function handleGenerateSample(matchId) {
  const formData = new FormData(dom.recentForm);
  const payload = {
    gameName: formData.get("gameName"),
    tagLine: formData.get("tagLine"),
    platformRegion: formData.get("platformRegion"),
    matchId,
  };

  dom.fetchStatus.textContent = `${matchId} 기준으로 새 샘플을 생성하는 중입니다.`;

  try {
    const result = await fetchJson("/api/generate-sample", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    state.manifest = await loadManifest();
    await selectSample(result.sampleId);
    dom.fetchStatus.textContent = `${result.sampleId} 생성 완료 · ${result.analysis.matchSummary.champion} ${result.analysis.matchSummary.role} ${result.analysis.matchSummary.result}`;
  } catch (error) {
    dom.fetchStatus.textContent = `샘플 생성 실패: ${error.message}`;
  }
}

async function init() {
  try {
    state.manifest = await loadManifest();
    renderSampleSwitcher();
    const defaultSampleId = state.manifest[0]?.id || "sample-001";
    await selectSample(defaultSampleId);
  } catch (error) {
    document.body.innerHTML = `
      <main class="fallback-shell">
        <h1>샘플 데이터를 불러오지 못했습니다.</h1>
        <p>${error.message}</p>
      </main>
    `;
    return;
  }

  dom.sampleSwitcher.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sample-button]");
    if (!button) return;
    selectSample(button.dataset.sampleButton);
  });

  dom.candidateList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-generate-match]");
    if (!button) return;
    handleGenerateSample(button.dataset.generateMatch);
  });

  dom.recentForm.addEventListener("submit", handleRecentMatchesSubmit);
}

init();
