import {
  buildFocusModel,
  findFocusMomentId,
} from "./coaching-plan.js";

const EVIDENCE_MOMENT_LIMIT = 4;

const elements = {
  sampleSelect: document.querySelector("[data-sample-select]"),
  statusMessage: document.querySelector("[data-status-message]"),
  matchMeta: document.querySelector("[data-match-meta]"),
  headline: document.querySelector("[data-analysis-headline]"),
  coachSummary: document.querySelector("[data-coach-summary]"),
  metrics: document.querySelector("[data-evidence-metrics]"),
  focusContent: document.querySelector("[data-focus-content]"),
  evidenceTitle: document.querySelector("#evidence-title"),
  moments: document.querySelector("[data-evidence-moments]"),
  observedList: document.querySelector("[data-observed-list]"),
  interpretation: document.querySelector("[data-interpretation-copy]"),
  protocolList: document.querySelector("[data-action-checklist]"),
  protocolProgress: document.querySelector("[data-protocol-progress]"),
  evidenceTrace: document.querySelector("[data-evidence-trace]"),
  traceCount: document.querySelector("[data-trace-count]"),
};

const state = {
  mode: "loading",
  samples: [],
  selectedSampleId: "",
  detail: null,
  activeMomentId: "",
  checkedProtocols: new Set(),
  requestController: null,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setAppState(mode, message) {
  state.mode = mode;
  document.body.dataset.appState = mode;
  elements.statusMessage.textContent = message;
}

async function fetchJson(url, signal) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `요청을 완료하지 못했습니다. (${response.status})`);
  }
  return response.json();
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number * 100)}%` : "—";
}

function formatNumber(value, fractionDigits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString("ko-KR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function phaseLabel(phase) {
  return {
    EARLY: "초반",
    MID: "중반",
    LATE: "후반",
  }[phase] || phase || "장면";
}

function eventTypeLabel(eventType) {
  return {
    PLAYER_DEATH: "플레이어 사망",
    CHAMPION_KILL: "챔피언 처치",
    SKIRMISH_WIN: "소규모 교전 승리",
    SKIRMISH_LOSS: "소규모 교전 패배",
    TEAMFIGHT_FOLLOWUP: "교전 후속 합류",
    DRAGON_FIGHT: "드래곤 교전",
    BARON_FIGHT: "바론 교전",
    OBJECTIVE_SETUP_WIN: "오브젝트 준비 성공",
    OBJECTIVE_SETUP_FAIL: "오브젝트 준비 실패",
    TOWER_TAKE: "구조물 파괴",
  }[eventType] || String(eventType || "타임라인 이벤트").replaceAll("_", " ");
}

function locationLabel(laneHint) {
  return {
    RIVER: "강가",
    TOP_RIVER: "상단 강가",
    DRAGON_RIVER: "드래곤 둥지",
    BARON_RIVER: "바론 둥지",
    TOP_LANE: "탑 라인",
    MID_LANE: "미드 라인",
    BOT_LANE: "봇 라인",
  }[laneHint] || String(laneHint || "위치 미상").replaceAll("_", " ");
}

function renderSampleOptions(samples, selectedId) {
  elements.sampleSelect.replaceChildren();
  for (const sample of samples) {
    const option = document.createElement("option");
    option.value = sample.id;
    option.textContent = sample.label || `${sample.champion || "Unknown"} · ${sample.collectedDate || ""}`;
    option.selected = sample.id === selectedId;
    elements.sampleSelect.append(option);
  }
  elements.sampleSelect.disabled = samples.length === 0;
}

function renderMatchOverview(detail) {
  const normalized = detail?.normalized;
  const analysis = detail?.analysis;
  const matchInfo = normalized?.matchInfo || {};
  const playerStats = normalized?.playerStats || {};
  const playtimeScore = normalized?.playtimeScore;
  const coachSummary = analysis?.coachSummary?.overallSummary;
  const headline = analysis?.matchSummary?.headline || detail?.theme;
  const resultClass = matchInfo.result === "WIN" ? "is-win" : "is-loss";
  const resultLabel = matchInfo.result === "WIN" ? "승리" : matchInfo.result === "LOSS" ? "패배" : matchInfo.result;

  const metaItems = [
    { value: matchInfo.champion, className: "" },
    { value: matchInfo.position, className: "" },
    { value: resultLabel, className: resultClass },
    { value: matchInfo.durationLabel, className: "" },
    { value: detail?.collectedDate, className: "" },
  ].filter((item) => item.value);

  elements.matchMeta.innerHTML = metaItems
    .map((item) => `<span class="${item.className}">${escapeHtml(item.value)}</span>`)
    .join("");
  elements.headline.textContent = headline || "분석할 수 있는 경기 요약이 없습니다.";
  elements.coachSummary.textContent = coachSummary || "이 경기에는 코칭 요약이 포함되어 있지 않습니다.";

  const kda = Number.isFinite(Number(playerStats.kda))
    ? Number(playerStats.kda)
    : (Number(playerStats.kills || 0) + Number(playerStats.assists || 0)) / Math.max(1, Number(playerStats.deaths || 0));
  const playtimeOverall = Number(playtimeScore?.overall);
  const playtimeNote = Number.isFinite(playtimeOverall)
    ? `플레이타임 점수 ${formatNumber(playtimeScore?.overall, 1)}${playtimeScore?.label ? ` · ${playtimeScore.label}` : ""}`
    : "팀 킬 기준";
  const metricData = [
    {
      label: "KDA",
      value: formatNumber(kda, 2),
      note: `${formatNumber(playerStats.kills)} / ${formatNumber(playerStats.deaths)} / ${formatNumber(playerStats.assists)}`,
    },
    {
      label: "시야 점수",
      value: formatNumber(playerStats.visionScore),
      note: "Riot 경기 기록",
    },
    {
      label: "킬 관여",
      value: formatPercent(playerStats.killParticipation),
      note: playtimeNote,
    },
  ];

  elements.metrics.innerHTML = metricData
    .map(
      (metric) => `
        <article class="metric">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(metric.value)}</strong>
          <small>${escapeHtml(metric.note)}</small>
        </article>`,
    )
    .join("");
}

function getMoments(analysis) {
  const keyMoments = Array.isArray(analysis?.keyMoments) ? analysis.keyMoments : [];
  if (keyMoments.length > 0) {
    return keyMoments.slice(0, EVIDENCE_MOMENT_LIMIT).map((moment, index) => ({
      ...moment,
      id: moment.id || moment.eventId || `moment-${index}`,
      description: moment.description || moment.detail || "",
      relatedEventIds: Array.isArray(moment.relatedEventIds)
        ? moment.relatedEventIds
        : moment.eventId
          ? [moment.eventId]
          : [],
    }));
  }

  return [...(analysis?.weaknesses || []), ...(analysis?.strengths || [])]
    .slice(0, EVIDENCE_MOMENT_LIMIT)
    .map((entry, index) => ({
      id: entry.id || `fallback-${index}`,
      timestampLabel: "근거",
      phase: "",
      title: entry.title,
      description: entry.description,
      relatedEventIds: entry.relatedEventIds,
    }));
}

function renderMoments(detail) {
  const moments = getMoments(detail?.analysis);
  elements.moments.replaceChildren();

  if (moments.length === 0) {
    elements.moments.innerHTML = '<p class="empty-copy">이 경기에는 선택할 수 있는 핵심 장면이 없습니다.</p>';
    state.activeMomentId = "";
    renderMomentDetail(null, detail?.normalized);
    return;
  }

  const requestedMoment = moments.find((moment) => moment.id === state.activeMomentId);
  const activeMoment = requestedMoment || moments[0];
  state.activeMomentId = activeMoment.id;

  moments.forEach((moment, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "evidence-moment";
    button.setAttribute("data-evidence-moment", moment.id);
    button.setAttribute("aria-pressed", String(moment.id === activeMoment.id));
    button.innerHTML = `
      <span class="evidence-moment__meta">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <span>${escapeHtml(moment.timestampLabel || phaseLabel(moment.phase))}</span>
      </span>
      <strong>${escapeHtml(moment.title || "핵심 장면")}</strong>`;
    button.addEventListener("click", () => selectMoment(moment.id));
    elements.moments.append(button);
  });

  renderMomentDetail(activeMoment, detail?.normalized);
}

function renderFocus(model) {
  if (!model) {
    elements.focusContent.innerHTML =
      '<p class="empty-copy">이 경기에는 우선 적용할 코칭 포커스가 없습니다.</p>';
    return;
  }

  elements.focusContent.innerHTML = `
    <div class="focus-card__copy">
      <span>핵심 약점 · 연결 근거 ${escapeHtml(model.evidenceCount)}건</span>
      <h3>${escapeHtml(model.title || "핵심 약점")}</h3>
      <p>${escapeHtml(model.description || "이 약점의 상세 설명이 없습니다.")}</p>
    </div>
    <div class="focus-card__action">
      <span>다음 경기 대표 행동</span>
      <strong>${escapeHtml(model.actionText || "연결된 실행 행동이 없습니다.")}</strong>
      <button type="button" data-focus-evidence>근거 장면 보기</button>
    </div>`;

  elements.focusContent
    .querySelector("[data-focus-evidence]")
    .addEventListener("click", () => moveFocusToEvidence(model));
}

function moveFocusToEvidence(model) {
  const moments = getMoments(state.detail?.analysis);
  const momentId = findFocusMomentId(model, moments);
  if (momentId && momentId !== state.activeMomentId) {
    selectMoment(momentId);
  } else if (momentId) {
    setAppState("ready", "이미 선택된 근거 장면으로 이동했습니다.");
  } else {
    setAppState("ready", "관련 장면이 없어 근거 영역으로 이동했습니다.");
  }
  const reducedMotion = window
    .matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  elements.evidenceTitle.focus({ preventScroll: true });
  elements.evidenceTitle.scrollIntoView({
    behavior: reducedMotion ? "auto" : "smooth",
    block: "start",
  });
}

function selectMoment(momentId) {
  const moments = getMoments(state.detail?.analysis);
  const selected = moments.find((moment) => moment.id === momentId);
  if (!selected) return;
  state.activeMomentId = selected.id;
  for (const button of elements.moments.querySelectorAll("[data-evidence-moment]")) {
    button.setAttribute("aria-pressed", String(button.dataset.evidenceMoment === selected.id));
  }
  renderMomentDetail(selected, state.detail?.normalized);
}

function renderMomentDetail(moment, normalized) {
  if (!moment) {
    elements.observedList.innerHTML = "<li>연결된 타임라인 근거가 없습니다.</li>";
    elements.interpretation.textContent = "표시할 AI 해석이 없습니다.";
    return;
  }

  const relatedEventIds = new Set(Array.isArray(moment.relatedEventIds) ? moment.relatedEventIds : []);
  const timelineEvents = Array.isArray(normalized?.timelineEvents) ? normalized.timelineEvents : [];
  const observedEvents = timelineEvents.filter((event) => relatedEventIds.has(event.eventId));

  elements.observedList.innerHTML = observedEvents.length
    ? observedEvents
        .map(
          (event) => `
            <li>
              <strong>${escapeHtml(event.timestampLabel || "시간 미상")} · ${escapeHtml(phaseLabel(event.phase))}</strong><br />
              ${escapeHtml(eventTypeLabel(event.eventType))} · ${escapeHtml(locationLabel(event.laneHint))} · ${event.isPlayerInvolved ? "본인 관여" : "팀 이벤트"}
            </li>`,
        )
        .join("")
    : "<li>이 해석에 직접 연결된 타임라인 이벤트가 없습니다.</li>";
  elements.interpretation.textContent = moment.description || "이 장면에 대한 AI 해석이 없습니다.";
}

function renderProtocols(analysis) {
  const checklist = Array.isArray(analysis?.actionChecklist) ? analysis.actionChecklist : [];
  state.checkedProtocols = new Set();

  if (checklist.length === 0) {
    elements.protocolList.innerHTML = '<p class="empty-copy">이 경기에는 실행 루틴이 포함되어 있지 않습니다.</p>';
    updateProtocolProgress(0);
    return;
  }

  elements.protocolList.innerHTML = checklist
    .map((action, index) => {
      const actionCopy = action.text
        || [action.title, action.description || action.detail].filter(Boolean).join(" — ")
        || "실행 항목";
      return `
        <div class="protocol-item">
          <label>
            <input type="checkbox" data-protocol-check="${escapeHtml(action.id || index)}" />
            <span class="protocol-check" aria-hidden="true">✓</span>
            <span class="protocol-copy">
              <strong>ROUTINE ${String(index + 1).padStart(2, "0")}</strong>
              <span>${escapeHtml(actionCopy)}</span>
            </span>
            <span class="protocol-tag">IN GAME</span>
          </label>
        </div>`;
    })
    .join("");

  for (const checkbox of elements.protocolList.querySelectorAll("[data-protocol-check]")) {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.checkedProtocols.add(checkbox.dataset.protocolCheck);
      else state.checkedProtocols.delete(checkbox.dataset.protocolCheck);
      updateProtocolProgress(checklist.length);
    });
  }
  updateProtocolProgress(checklist.length);
}

function updateProtocolProgress(total) {
  elements.protocolProgress.textContent = `${state.checkedProtocols.size} / ${total} READY`;
}

function renderTrace(analysis, normalized) {
  const rawEvidenceIndex = analysis?.evidenceIndex;
  const timelineEvents = Array.isArray(normalized?.timelineEvents) ? normalized.timelineEvents : [];
  const withTimelineCopy = (entry) => {
    const event = timelineEvents.find((timelineEvent) => timelineEvent.eventId === entry.eventId);
    return {
      ...entry,
      shortNote: entry.shortNote || (event
        ? `${event.timestampLabel || "시간 미상"} ${eventTypeLabel(event.eventType)} · ${locationLabel(event.laneHint)}`
        : "세부 기록 없음"),
    };
  };
  const evidence = Array.isArray(rawEvidenceIndex)
    ? rawEvidenceIndex.map(withTimelineCopy)
    : rawEvidenceIndex && typeof rawEvidenceIndex === "object"
      ? Object.entries(rawEvidenceIndex).map(([eventId, linkedAnalysisIds]) => {
          const event = timelineEvents.find((entry) => entry.eventId === eventId);
          const fallbackLinks = Array.isArray(linkedAnalysisIds) ? linkedAnalysisIds.join(", ") : "분석 연결";
          return {
            eventId,
            shortNote: event
              ? `${event.timestampLabel || "시간 미상"} ${eventTypeLabel(event.eventType)} · ${locationLabel(event.laneHint)}`
              : fallbackLinks,
          };
        })
      : [];
  elements.traceCount.textContent = `${evidence.length} EVIDENCE POINTS`;
  elements.evidenceTrace.innerHTML = evidence.length
    ? evidence
        .map(
          (entry) => `
            <li>
              <span>${escapeHtml(entry.eventId || "EVENT")}</span>
              <p>${escapeHtml(entry.shortNote || "세부 기록 없음")}</p>
            </li>`,
        )
        .join("")
    : "<li><span>—</span><p>이 경기에는 근거 인덱스가 없습니다.</p></li>";
}

function renderDetail(detail) {
  state.detail = detail;
  state.activeMomentId = "";
  renderMatchOverview(detail);
  renderMoments(detail);
  renderFocus(buildFocusModel(detail?.analysis));
  renderProtocols(detail?.analysis);
  renderTrace(detail?.analysis, detail?.normalized);
}

function resetDependentPanels(mode = "empty") {
  const isLoading = mode === "loading";
  const placeholder = isLoading ? "불러오는 중" : "데이터 없음";
  state.detail = null;
  state.activeMomentId = "";
  state.checkedProtocols = new Set();
  elements.matchMeta.innerHTML = `<span>${placeholder}</span>`;
  elements.headline.textContent = isLoading
    ? "새 경기의 분석 근거를 연결하고 있습니다."
    : "분석할 수 있는 경기 데이터가 없습니다.";
  elements.coachSummary.textContent = isLoading
    ? "잠시만 기다리면 코칭 요약이 표시됩니다."
    : "표시할 코칭 요약이 없습니다.";
  elements.metrics.innerHTML = ["KDA", "시야 점수", "킬 관여"]
    .map((label) => `<article class="metric"><span>${label}</span><strong>—</strong><small>${placeholder}</small></article>`)
    .join("");
  elements.focusContent.innerHTML = `<p class="empty-copy">${isLoading
    ? "다음 게임 포커스를 불러오는 중입니다."
    : "표시할 코칭 포커스가 없습니다."}</p>`;
  elements.moments.innerHTML = `<p class="empty-copy">${isLoading ? "핵심 장면을 불러오는 중입니다." : "표시할 핵심 장면이 없습니다."}</p>`;
  elements.observedList.innerHTML = `<li>${isLoading ? "타임라인 근거를 불러오는 중입니다." : "연결된 타임라인 근거가 없습니다."}</li>`;
  elements.interpretation.textContent = isLoading ? "AI 해석을 불러오는 중입니다." : "표시할 AI 해석이 없습니다.";
  elements.protocolList.innerHTML = `<p class="empty-copy">${isLoading ? "실행 루틴을 불러오는 중입니다." : "표시할 실행 루틴이 없습니다."}</p>`;
  updateProtocolProgress(0);
  elements.evidenceTrace.innerHTML = `<li><span>—</span><p>${isLoading ? "근거 인덱스를 불러오는 중입니다." : "표시할 근거 인덱스가 없습니다."}</p></li>`;
  elements.traceCount.textContent = isLoading ? "LOADING" : "0 EVIDENCE POINTS";
}

function renderError(message) {
  resetDependentPanels();
  elements.headline.textContent = "분석 데이터를 열지 못했습니다.";
  elements.coachSummary.textContent = message;
  elements.metrics.innerHTML = ["KDA", "시야 점수", "킬 관여"]
    .map((label) => `<article class="metric"><span>${label}</span><strong>—</strong><small>데이터 없음</small></article>`)
    .join("");
}

async function loadSample(sampleId) {
  state.requestController?.abort();
  const requestController = new AbortController();
  state.requestController = requestController;
  state.selectedSampleId = sampleId;
  state.activeMomentId = "";
  elements.sampleSelect.disabled = true;
  resetDependentPanels("loading");
  setAppState("loading", "선택한 경기의 근거 데이터를 읽고 있습니다.");

  try {
    const detail = await fetchJson(`/api/samples/${encodeURIComponent(sampleId)}`, requestController.signal);
    renderDetail(detail);
    const currentSample = state.samples.find((sample) => sample.id === sampleId);
    setAppState("ready", `${currentSample?.champion || "선택한 경기"} 분석을 표시했습니다.`);
    const url = new URL(window.location.href);
    url.searchParams.set("sample", sampleId);
    history.replaceState(null, "", url);
  } catch (error) {
    if (error.name === "AbortError") return;
    setAppState("error", error.message || "분석 데이터를 불러오지 못했습니다.");
    renderError(error.message || "잠시 후 다시 시도해 주세요.");
  } finally {
    if (state.requestController === requestController) {
      elements.sampleSelect.disabled = state.samples.length === 0;
    }
  }
}

async function start() {
  setAppState("loading", "공개 분석 경기 목록을 확인하고 있습니다.");
  try {
    const manifest = await fetchJson("/api/samples");
    state.samples = Array.isArray(manifest?.samples) ? manifest.samples : [];
    if (state.samples.length === 0) {
      setAppState("empty", "표시할 공개 분석 경기가 없습니다.");
      renderSampleOptions([], "");
      renderError("큐레이션된 공개 샘플이 추가되면 이곳에서 분석할 수 있습니다.");
      return;
    }

    const requestedId = new URLSearchParams(window.location.search).get("sample");
    const selectedId = state.samples.some((sample) => sample.id === requestedId)
      ? requestedId
      : state.samples[0].id;
    renderSampleOptions(state.samples, selectedId);
    await loadSample(selectedId);
  } catch (error) {
    setAppState("error", error.message || "경기 목록을 불러오지 못했습니다.");
    renderError(error.message || "네트워크 상태를 확인해 주세요.");
  }
}

elements.sampleSelect.addEventListener("change", (event) => {
  if (event.target.value) loadSample(event.target.value);
});

start();
