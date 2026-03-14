const draftStore = window.LolDraftState;
let store = draftStore.loadStore();

const dom = {
  live: document.querySelector("[data-admin-live]"),
  series: document.querySelector("[data-admin-series]"),
  phase: document.querySelector("[data-admin-phase]"),
  teams: {
    blue: document.querySelector('[data-team-editor="blue"]'),
    red: document.querySelector('[data-team-editor="red"]'),
  },
};

function currentStep() {
  return draftStore.getCurrentStep(store);
}

function currentTeam(teamKey) {
  return store.teams[teamKey];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function selectField(config) {
  const options = config.options
    .map((option) => {
      const selected = String(option.value) === String(config.value) ? "selected" : "";
      return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(option.label)}</option>`;
    })
    .join("");

  return `
    <label class="field ${config.full ? "field--full" : ""}">
      <span>${escapeHtml(config.label)}</span>
      <select name="${escapeHtml(config.name)}">${options}</select>
    </label>
  `;
}

function inputField(config) {
  if (config.kind === "textarea") {
    return `
      <label class="field ${config.full ? "field--full" : ""}">
        <span>${escapeHtml(config.label)}</span>
        <textarea name="${escapeHtml(config.name)}" rows="${config.rows || 4}">${escapeHtml(config.value)}</textarea>
      </label>
    `;
  }

  const dataUnit = config.unit ? `data-unit="${config.unit}"` : "";
  return `
    <label class="field ${config.full ? "field--full" : ""}">
      <span>${escapeHtml(config.label)}</span>
      <input
        name="${escapeHtml(config.name)}"
        type="${config.type || "text"}"
        value="${escapeHtml(config.value)}"
        ${config.attrs || ""}
        ${dataUnit}
      />
    </label>
  `;
}

function renderLivePanel() {
  const step = currentStep();
  const team = currentTeam(step.team);
  const turnOptions = store.sequence.map((entry, index) => ({
    value: index,
    label: `#${entry.turn} ${store.teams[entry.team].name} ${entry.label}`,
  }));

  dom.live.innerHTML = `
    <div class="card-head">
      <div>
        <p class="eyebrow">Live Controls</p>
        <h2>송출 제어</h2>
      </div>
      <span class="live-badge ${store.live.running ? "live-badge--on" : "live-badge--off"}">
        ${store.live.running ? "LIVE" : "PAUSED"}
      </span>
    </div>

    <div class="summary-grid">
      <article class="summary-tile">
        <span class="tile-label">현재 단계</span>
        <strong>${escapeHtml(team.name)} ${escapeHtml(step.label)}</strong>
        <p>${escapeHtml(step.prompt)}</p>
      </article>
      <article class="summary-tile">
        <span class="tile-label">턴 / 전체</span>
        <strong>${step.turn} / ${store.sequence.length}</strong>
        <p>${escapeHtml(step.type)} slot ${step.slot + 1}</p>
      </article>
      <article class="summary-tile">
        <span class="tile-label">남은 시간</span>
        <strong>${draftStore.formatTimer(store.live.remainingMs)}</strong>
        <p>${escapeHtml(store.series.gameLabel)} · ${escapeHtml(store.series.format)}</p>
      </article>
    </div>

    <div class="action-row">
      <button type="button" class="btn" data-action="prev-turn">이전 턴</button>
      <button type="button" class="btn btn--accent" data-action="toggle-running">
        ${store.live.running ? "일시정지" : "재생"}
      </button>
      <button type="button" class="btn" data-action="next-turn">다음 턴</button>
      <button type="button" class="btn" data-action="reset-timer">타이머 리셋</button>
      <button type="button" class="btn btn--warn" data-action="reset-store">데모 상태 복원</button>
    </div>

    <div class="field-grid field-grid--compact">
      ${selectField({
        name: "live.turnIndex",
        label: "현재 턴",
        value: store.live.turnIndex,
        options: turnOptions,
      })}
      ${inputField({
        name: "live.remainingMs",
        label: "남은 시간(초)",
        value: Math.ceil(store.live.remainingMs / 1000),
        type: "number",
        attrs: 'min="0" step="1"',
        unit: "seconds",
      })}
    </div>

    <p class="hint">관리자 페이지가 열려 있는 동안에는 이 패널이 타이머를 계속 갱신합니다.</p>
  `;
}

function renderSeriesPanel() {
  dom.series.innerHTML = `
    <div class="card-head">
      <div>
        <p class="eyebrow">Broadcast Meta</p>
        <h2>방송 기본 정보</h2>
      </div>
    </div>

    <div class="field-grid">
      ${inputField({
        name: "broadcast.title",
        label: "메인 타이틀",
        value: store.broadcast.title,
        full: true,
      })}
      ${inputField({
        name: "broadcast.subtitle",
        label: "서브 타이틀",
        value: store.broadcast.subtitle,
        full: true,
      })}
      ${inputField({ name: "series.patch", label: "패치", value: store.series.patch })}
      ${inputField({ name: "series.format", label: "시리즈 형식", value: store.series.format })}
      ${inputField({ name: "series.gameLabel", label: "게임 라벨", value: store.series.gameLabel })}
      ${inputField({
        name: "series.firstSelection",
        label: "퍼스트 셀렉션 문구",
        value: store.series.firstSelection,
      })}
    </div>
  `;
}

function renderPhasePanel() {
  const step = currentStep();
  const stepPath = `sequence.${store.live.turnIndex}`;
  dom.phase.innerHTML = `
    <div class="card-head">
      <div>
        <p class="eyebrow">Phase Editor</p>
        <h2>현재 단계 편집</h2>
      </div>
      <span class="turn-chip">Turn ${step.turn}</span>
    </div>

    <div class="field-grid">
      ${selectField({
        name: `${stepPath}.team`,
        label: "팀",
        value: step.team,
        options: [
          { value: "blue", label: "Blue side" },
          { value: "red", label: "Red side" },
        ],
      })}
      ${selectField({
        name: `${stepPath}.type`,
        label: "단계 종류",
        value: step.type,
        options: [
          { value: "pick", label: "Pick" },
          { value: "ban", label: "Ban" },
        ],
      })}
      ${selectField({
        name: `${stepPath}.slot`,
        label: "슬롯 번호",
        value: step.slot,
        options: [0, 1, 2, 3, 4].map((slot) => ({
          value: slot,
          label: `Slot ${slot + 1}`,
        })),
      })}
      ${inputField({ name: `${stepPath}.label`, label: "표시 라벨", value: step.label })}
      ${inputField({
        name: `${stepPath}.duration`,
        label: "기본 시간(초)",
        value: step.duration,
        type: "number",
        attrs: 'min="1" step="1"',
      })}
      ${inputField({
        name: `${stepPath}.prompt`,
        label: "옵저버 문구",
        value: step.prompt,
        kind: "textarea",
        rows: 5,
        full: true,
      })}
    </div>
  `;
}

function renderTeamEditor(teamKey) {
  const team = currentTeam(teamKey);
  const teamLabel = teamKey === "blue" ? "Blue Side" : "Red Side";
  const sideShort = teamKey === "blue" ? "B" : "R";

  dom.teams[teamKey].innerHTML = `
    <div class="card-head">
      <div>
        <p class="eyebrow">${teamLabel}</p>
        <h2>${escapeHtml(team.name)}</h2>
      </div>
      <span class="side-badge side-badge--${teamKey}">${sideShort}</span>
    </div>

    <div class="field-grid">
      ${inputField({ name: `teams.${teamKey}.name`, label: "팀명", value: team.name })}
      ${inputField({
        name: `teams.${teamKey}.score`,
        label: "세트 점수",
        value: team.score,
        type: "number",
        attrs: 'min="0" step="1"',
      })}
      ${inputField({ name: `teams.${teamKey}.coach`, label: "코치", value: team.coach })}
      ${inputField({ name: `teams.${teamKey}.seed`, label: "시드", value: team.seed })}
    </div>

    <section class="editor-block">
      <div class="block-head">
        <h3>로스터</h3>
        <span>${team.roster.length} entries</span>
      </div>
      <div class="slot-grid">
        ${team.roster
          .map(
            (entry, index) => `
              <article class="slot-card">
                <span class="slot-index">${index + 1}</span>
                <div class="field-grid field-grid--compact">
                  ${inputField({
                    name: `teams.${teamKey}.roster.${index}.role`,
                    label: "포지션",
                    value: entry.role,
                  })}
                  ${inputField({
                    name: `teams.${teamKey}.roster.${index}.player`,
                    label: "선수",
                    value: entry.player,
                  })}
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="editor-block">
      <div class="block-head">
        <h3>픽 슬롯</h3>
        <span>${team.picks.length} entries</span>
      </div>
      <div class="slot-grid">
        ${team.picks
          .map(
            (entry, index) => `
              <article class="slot-card">
                <span class="slot-index">${index + 1}</span>
                <div class="field-grid field-grid--compact">
                  ${inputField({
                    name: `teams.${teamKey}.picks.${index}.champion`,
                    label: "챔피언",
                    value: entry.champion,
                  })}
                  ${inputField({
                    name: `teams.${teamKey}.picks.${index}.role`,
                    label: "라인",
                    value: entry.role,
                  })}
                  ${inputField({
                    name: `teams.${teamKey}.picks.${index}.player`,
                    label: "선수",
                    value: entry.player,
                  })}
                  ${inputField({
                    name: `teams.${teamKey}.picks.${index}.turn`,
                    label: "턴 번호",
                    value: entry.turn,
                    type: "number",
                    attrs: 'min="1" step="1"',
                  })}
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="editor-block">
      <div class="block-head">
        <h3>밴 슬롯</h3>
        <span>${team.bans.length} entries</span>
      </div>
      <div class="slot-grid">
        ${team.bans
          .map(
            (entry, index) => `
              <article class="slot-card">
                <span class="slot-index">${index + 1}</span>
                <div class="field-grid field-grid--compact">
                  ${inputField({
                    name: `teams.${teamKey}.bans.${index}.champion`,
                    label: "챔피언",
                    value: entry.champion,
                  })}
                  ${inputField({
                    name: `teams.${teamKey}.bans.${index}.turn`,
                    label: "턴 번호",
                    value: entry.turn,
                    type: "number",
                    attrs: 'min="1" step="1"',
                  })}
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="editor-block">
      <div class="block-head">
        <h3>Fearless Memory</h3>
        <span>${team.fearless.length} entries</span>
      </div>
      <div class="slot-grid">
        ${team.fearless
          .map(
            (entry, index) => `
              <article class="slot-card">
                <span class="slot-index">${index + 1}</span>
                <div class="field-grid field-grid--compact">
                  ${inputField({
                    name: `teams.${teamKey}.fearless.${index}.champion`,
                    label: "챔피언",
                    value: entry.champion,
                  })}
                  ${inputField({
                    name: `teams.${teamKey}.fearless.${index}.role`,
                    label: "라인",
                    value: entry.role,
                  })}
                  ${inputField({
                    name: `teams.${teamKey}.fearless.${index}.game`,
                    label: "게임",
                    value: entry.game,
                  })}
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderAll() {
  renderLivePanel();
  renderSeriesPanel();
  renderPhasePanel();
  renderTeamEditor("blue");
  renderTeamEditor("red");
}

function pathSegments(path) {
  return path.split(".").map((segment) => {
    if (/^\d+$/.test(segment)) {
      return Number(segment);
    }
    return segment;
  });
}

function setByPath(target, path, value) {
  const segments = pathSegments(path);
  let cursor = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    cursor = cursor[segments[index]];
  }
  cursor[segments[segments.length - 1]] = value;
}

function readValue(element) {
  if (element.dataset.unit === "seconds") {
    const seconds = Number(element.value);
    return Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 1000)) : 0;
  }

  if (element.type === "number") {
    const numericValue = Number(element.value);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  return element.value;
}

function saveAndRender() {
  store = draftStore.saveStore(store);
  renderAll();
}

function handleAction(action) {
  if (action === "prev-turn") {
    store = draftStore.jumpToTurn(store, store.live.turnIndex - 1);
    saveAndRender();
    return;
  }

  if (action === "next-turn") {
    store = draftStore.jumpToTurn(store, store.live.turnIndex + 1);
    saveAndRender();
    return;
  }

  if (action === "toggle-running") {
    store.live.running = !store.live.running;
    saveAndRender();
    return;
  }

  if (action === "reset-timer") {
    store.live.remainingMs = currentStep().duration * 1000;
    saveAndRender();
    return;
  }

  if (action === "reset-store") {
    store = draftStore.resetStore();
    renderAll();
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  handleAction(button.dataset.action);
});

document.addEventListener("change", (event) => {
  const field = event.target.closest("[name]");
  if (!field) {
    return;
  }

  if (field.name === "live.turnIndex") {
    store = draftStore.jumpToTurn(store, Number(field.value));
    saveAndRender();
    return;
  }

  const nextValue = readValue(field);
  setByPath(store, field.name, nextValue);

  if (field.name === `sequence.${store.live.turnIndex}.duration`) {
    store.live.remainingMs = Math.min(store.live.remainingMs, Math.max(1000, nextValue * 1000));
  }

  saveAndRender();
});

let lastTick = performance.now();
function animate(now) {
  const delta = Math.min(250, now - lastTick);
  lastTick = now;

  if (store.live.running) {
    const previousTurnIndex = store.live.turnIndex;
    const previousVisibleSeconds = Math.ceil(store.live.remainingMs / 1000);
    const previousRunning = store.live.running;
    store = draftStore.stepLive(store, delta);

    const nextVisibleSeconds = Math.ceil(store.live.remainingMs / 1000);
    const turnChanged = previousTurnIndex !== store.live.turnIndex;
    const secondsChanged = previousVisibleSeconds !== nextVisibleSeconds;
    const runningChanged = previousRunning !== store.live.running;

    if (turnChanged || secondsChanged || runningChanged) {
      store = draftStore.saveStore(store);
      renderLivePanel();
      if (turnChanged) {
        renderPhasePanel();
      }
    }
  }

  window.requestAnimationFrame(animate);
}

draftStore.subscribe((nextStore) => {
  store = nextStore;
  lastTick = performance.now();
  renderAll();
});

renderAll();
window.requestAnimationFrame(animate);
