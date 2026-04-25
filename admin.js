const draftStore = window.LolDraftState;

function coercePickOrderFlow(candidateStore) {
  const nextStore = draftStore.clone(candidateStore);

  if (nextStore.selection.priorityChoiceType === "pickOrder") {
    return nextStore;
  }

  const resolved = draftStore.resolveAssignments(nextStore);
  const priorityTeam = resolved.pickOrderToTeam.first;

  nextStore.selection = {
    priorityTeam,
    priorityChoiceType: "pickOrder",
    priorityChoiceValue: "first",
    counterChoiceValue: resolved.teamToSide[draftStore.getOtherTeamKey(priorityTeam)],
  };

  return nextStore;
}

let store = coercePickOrderFlow(draftStore.loadStore());
store = draftStore.saveStore(store);

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

function assignments() {
  return draftStore.resolveAssignments(store);
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

// Phase 4: name → 안정적인 id 변환 (접근성 보조 기술이 명시적 for/id 매칭을 선호)
function fieldId(name) {
  return "fld-" + String(name).replace(/[^a-zA-Z0-9_-]/g, "-");
}

function selectField(config) {
  const options = config.options
    .map((option) => {
      const selected = String(option.value) === String(config.value) ? "selected" : "";
      return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(option.label)}</option>`;
    })
    .join("");

  const id = fieldId(config.name);
  return `
    <div class="field ${config.full ? "field--full" : ""}">
      <label for="${id}"><span>${escapeHtml(config.label)}</span></label>
      <select id="${id}" name="${escapeHtml(config.name)}">${options}</select>
    </div>
  `;
}

function inputField(config) {
  const id = fieldId(config.name);
  if (config.kind === "textarea") {
    return `
      <div class="field ${config.full ? "field--full" : ""}">
        <label for="${id}"><span>${escapeHtml(config.label)}</span></label>
        <textarea id="${id}" name="${escapeHtml(config.name)}" rows="${config.rows || 4}">${escapeHtml(config.value)}</textarea>
      </div>
    `;
  }

  const dataUnit = config.unit ? `data-unit="${config.unit}"` : "";
  return `
    <div class="field ${config.full ? "field--full" : ""}">
      <label for="${id}"><span>${escapeHtml(config.label)}</span></label>
      <input
        id="${id}"
        name="${escapeHtml(config.name)}"
        type="${config.type || "text"}"
        value="${escapeHtml(config.value)}"
        ${config.attrs || ""}
        ${dataUnit}
      />
    </div>
  `;
}

function summaryTile(label, value, copy) {
  return `
    <article class="summary-tile">
      <span class="tile-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(copy)}</p>
    </article>
  `;
}

function sideLabel(side) {
  return side === "blue" ? "Blue Side" : "Red Side";
}

function pickOrderLabel(order) {
  return order === "first" ? "First Pick" : "Second Pick";
}

function choiceRoleLabel(teamKey) {
  return teamKey === assignments().priorityTeam ? "선픽/후픽 선택" : "블루/레드 선택";
}

function decisionSummary(teamKey) {
  const resolved = assignments();
  if (teamKey === resolved.priorityTeam) {
    return `${pickOrderLabel(store.selection.priorityChoiceValue)} 선택`;
  }
  return `${sideLabel(store.selection.counterChoiceValue)} 선택`;
}

function renderLivePanel() {
  const resolved = assignments();
  const step = currentStep();
  const actingTeamKey = resolved.pickOrderToTeam[step.order];
  const actingTeam = currentTeam(actingTeamKey);
  const actingSide = resolved.teamToSide[actingTeamKey];
  const turnOptions = store.sequence.map((entry, index) => {
    const entryTeamKey = resolved.pickOrderToTeam[entry.order];
    const entrySide = resolved.teamToSide[entryTeamKey];
    return {
      value: index,
      label: `#${entry.turn} ${currentTeam(entryTeamKey).name} · ${pickOrderLabel(entry.order)} · ${sideLabel(entrySide)} · ${entry.label}`,
    };
  });

  dom.live.innerHTML = `
    <div class="card-head">
      <div>
        <p class="eyebrow">Live Controls</p>
        <h2>송출 제어</h2>
      </div>
      <span
        class="live-badge ${store.live.running ? "live-badge--on" : "live-badge--off"}"
        role="status"
        aria-live="polite"
        aria-label="${store.live.running ? "방송 라이브 중" : "방송 일시정지 상태"}"
      >
        ${store.live.running ? "LIVE" : "PAUSED"}
      </span>
    </div>

    <div class="summary-grid">
      ${summaryTile("현재 단계", `${actingTeam.name} ${step.label}`, `${pickOrderLabel(step.order)} · ${sideLabel(actingSide)}`)}
      ${summaryTile("턴 / 전체", `${step.turn} / ${store.sequence.length}`, `${step.type} slot ${step.slot + 1}`)}
      ${summaryTile("현재 매칭", `${currentTeam(resolved.sideToTeam.blue).name} vs ${currentTeam(resolved.sideToTeam.red).name}`, `Blue ${currentTeam(resolved.sideToTeam.blue).name} · Red ${currentTeam(resolved.sideToTeam.red).name}`)}
      ${summaryTile("남은 시간", draftStore.formatTimer(store.live.remainingMs), `${store.series.gameLabel} · ${store.series.format} · Patch ${store.series.patch}`)}
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

    <p class="hint">현재 단계는 First Pick / Second Pick 기준으로 움직이고, 실제 Blue / Red 배정은 위 선택 정보에서 자동으로 따라옵니다.</p>
  `;
}

function renderSeriesPanel() {
  const resolved = assignments();
  const priorityTeam = currentTeam(resolved.priorityTeam);
  const counterTeam = currentTeam(resolved.otherTeam);
  const blueTeam = currentTeam(resolved.sideToTeam.blue);
  const redTeam = currentTeam(resolved.sideToTeam.red);

  dom.series.innerHTML = `
    <div class="card-head">
      <div>
        <p class="eyebrow">Broadcast Meta</p>
        <h2>방송 기본 정보</h2>
      </div>
    </div>

    <div class="summary-grid">
      ${summaryTile("선택 우선권", priorityTeam.name, `${priorityTeam.name}이 선픽/후픽을 먼저 선택합니다.`)}
      ${summaryTile("우선권 팀 결정", pickOrderLabel(store.selection.priorityChoiceValue), `${priorityTeam.name} 선택`)}
      ${summaryTile("상대 팀 결정", `${counterTeam.name} · ${sideLabel(store.selection.counterChoiceValue)}`, `${counterTeam.name}이 블루/레드를 선택합니다.`)}
      ${summaryTile("최종 배치", `Blue ${blueTeam.name} / Red ${redTeam.name}`, `선픽 ${currentTeam(resolved.pickOrderToTeam.first).name} · 후픽 ${currentTeam(resolved.pickOrderToTeam.second).name}`)}
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
      ${selectField({
        name: "selection.priorityTeam",
        label: "선택 우선권 팀",
        value: store.selection.priorityTeam,
        options: draftStore.TEAM_IDS.map((teamKey) => ({
          value: teamKey,
          label: currentTeam(teamKey).name,
        })),
      })}
      ${selectField({
        name: "selection.priorityChoiceValue",
        label: `${priorityTeam.name} 선택`,
        value: store.selection.priorityChoiceValue,
        options: [
          { value: "first", label: "First Pick" },
          { value: "second", label: "Second Pick" },
        ],
      })}
      ${selectField({
        name: "selection.counterChoiceValue",
        label: `${counterTeam.name} 사이드 선택`,
        value: store.selection.counterChoiceValue,
        options: [
          { value: "blue", label: "Blue Side" },
          { value: "red", label: "Red Side" },
        ],
      })}
    </div>

    <p class="hint">흐름은 고정입니다. 한 팀이 선픽/후픽을 고르면, 나머지 팀이 블루/레드 사이드를 고릅니다.</p>
  `;
}

function renderPhasePanel() {
  const resolved = assignments();
  const step = currentStep();
  const actingTeamKey = resolved.pickOrderToTeam[step.order];
  const actingTeam = currentTeam(actingTeamKey);
  const actingSide = resolved.teamToSide[actingTeamKey];
  const stepPath = `sequence.${store.live.turnIndex}`;

  dom.phase.innerHTML = `
    <div class="card-head">
      <div>
        <p class="eyebrow">Phase Editor</p>
        <h2>현재 단계 편집</h2>
      </div>
      <span class="turn-chip">Turn ${step.turn}</span>
    </div>

    <div class="summary-grid">
      ${summaryTile("실행 팀", actingTeam.name, `${actingTeam.name} 차례`)}
      ${summaryTile("현재 사이드", sideLabel(actingSide), `${actingTeam.name} 기준`)}
      ${summaryTile("픽 순서", pickOrderLabel(step.order), `${step.type} slot ${step.slot + 1}`)}
    </div>

    <div class="field-grid">
      ${selectField({
        name: `${stepPath}.order`,
        label: "픽 순서",
        value: step.order,
        options: [
          { value: "first", label: "First Pick" },
          { value: "second", label: "Second Pick" },
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

    <p class="hint">단계 순서는 Blue / Red가 아니라 First Pick / Second Pick 기준으로 저장됩니다.</p>
  `;
}

function renderTeamEditor(teamKey) {
  const team = currentTeam(teamKey);
  const resolved = assignments();
  const currentSide = resolved.teamToSide[teamKey];
  const currentOrder = resolved.teamToPickOrder[teamKey];
  const sideShort = currentSide === "blue" ? "B" : "R";

  dom.teams[teamKey].innerHTML = `
    <div class="card-head">
      <div>
        <p class="eyebrow">Team Record</p>
        <h2>${escapeHtml(team.name)}</h2>
      </div>
      <span class="side-badge side-badge--${currentSide}">${sideShort}</span>
    </div>

    <div class="summary-grid summary-grid--team">
      ${summaryTile("현재 사이드", sideLabel(currentSide), `${team.name} 배정`)}
      ${summaryTile("픽 순서", pickOrderLabel(currentOrder), `${team.name} 차례 기준`)}
      ${summaryTile("선택 역할", choiceRoleLabel(teamKey), teamKey === resolved.priorityTeam ? "이 팀이 선픽/후픽을 고릅니다." : "이 팀이 블루/레드를 고릅니다.")}
      ${summaryTile("현재 결정", decisionSummary(teamKey), `${team.name} 관점 요약`)}
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
  store = coercePickOrderFlow(store);
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
  store = coercePickOrderFlow(store);
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
    store = coercePickOrderFlow(draftStore.resetStore());
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

  if (field.name.startsWith("selection.")) {
    store.selection.priorityChoiceType = "pickOrder";
  }

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
  store = coercePickOrderFlow(nextStore);
  lastTick = performance.now();
  renderAll();
});

renderAll();
window.requestAnimationFrame(animate);
