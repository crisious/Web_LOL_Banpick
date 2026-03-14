const draftStore = window.LolDraftState;
let store = draftStore.loadStore();

const dom = {
  broadcastTitle: document.querySelector("[data-broadcast-title]"),
  broadcastSubtitle: document.querySelector("[data-broadcast-subtitle]"),
  bluePanel: document.querySelector('[data-team-panel="blue"]'),
  redPanel: document.querySelector('[data-team-panel="red"]'),
  phaseTrack: document.querySelector("[data-phase-track]"),
  bluePickStack: document.querySelector('[data-pick-stack="blue"]'),
  redPickStack: document.querySelector('[data-pick-stack="red"]'),
  blueBanStrip: document.querySelector('[data-ban-strip="blue"]'),
  redBanStrip: document.querySelector('[data-ban-strip="red"]'),
  blueFearless: document.querySelector('[data-fearless-column="blue"]'),
  redFearless: document.querySelector('[data-fearless-column="red"]'),
  timerValue: document.querySelector("[data-timer-value]"),
  phaseTitle: document.querySelector("[data-phase-title]"),
  phaseCounter: document.querySelector("[data-phase-counter]"),
  patchVersion: document.querySelector("[data-patch-version]"),
  liveState: document.querySelector("[data-live-state]"),
  activeTeam: document.querySelector("[data-active-team]"),
  activeCopy: document.querySelector("[data-active-copy]"),
  activeRole: document.querySelector("[data-active-role]"),
  activeKind: document.querySelector("[data-active-kind]"),
  seriesFormat: document.querySelector("[data-series-format]"),
  seriesGame: document.querySelector("[data-series-game]"),
  priorityChoice: document.querySelector("[data-priority-choice]"),
  counterChoice: document.querySelector("[data-counter-choice]"),
};

function currentStep() {
  return draftStore.getCurrentStep(store);
}

function assignments() {
  return draftStore.resolveAssignments(store);
}

function teamRecord(teamKey) {
  return store.teams[teamKey];
}

function teamBySide(side) {
  return teamRecord(assignments().sideToTeam[side]);
}

function teamByPickOrder(order) {
  return teamRecord(assignments().pickOrderToTeam[order]);
}

function formatSeconds(milliseconds) {
  return draftStore.formatTimer(milliseconds);
}

function sideLabel(side) {
  return side === "blue" ? "Blue Side" : "Red Side";
}

function pickOrderLabel(order) {
  return order === "first" ? "First Pick" : "Second Pick";
}

function selectionSummary() {
  const resolved = assignments();
  const priorityTeam = teamRecord(resolved.priorityTeam);
  const otherTeam = teamRecord(resolved.otherTeam);
  const priorityChoice =
    store.selection.priorityChoiceType === "pickOrder"
      ? pickOrderLabel(store.selection.priorityChoiceValue)
      : sideLabel(store.selection.priorityChoiceValue);
  const counterChoice =
    store.selection.priorityChoiceType === "pickOrder"
      ? sideLabel(store.selection.counterChoiceValue)
      : pickOrderLabel(store.selection.counterChoiceValue);

  return {
    priorityChoice: `${priorityTeam.name} chose ${priorityChoice}`,
    counterChoice: `${otherTeam.name} chose ${counterChoice}`,
  };
}

function slotState(turn) {
  const currentTurn = currentStep().turn;
  if (turn < currentTurn) {
    return "locked";
  }
  if (turn === currentTurn) {
    return "active";
  }
  return "pending";
}

function renderMeta() {
  const summary = selectionSummary();
  dom.broadcastTitle.textContent = store.broadcast.title;
  dom.broadcastSubtitle.textContent = store.broadcast.subtitle;
  document.querySelector('[data-score-name="blue"]').textContent = teamBySide("blue").name;
  document.querySelector('[data-score-name="red"]').textContent = teamBySide("red").name;
  document.querySelector('[data-score="blue"]').textContent = teamBySide("blue").score;
  document.querySelector('[data-score="red"]').textContent = teamBySide("red").score;
  dom.seriesFormat.textContent = store.series.format;
  dom.seriesGame.textContent = store.series.gameLabel;
  dom.priorityChoice.textContent = summary.priorityChoice;
  dom.counterChoice.textContent = summary.counterChoice;
  dom.patchVersion.textContent = store.series.patch;
}

function renderTeamPanel(side) {
  const panel = side === "blue" ? dom.bluePanel : dom.redPanel;
  const resolved = assignments();
  const teamKey = resolved.sideToTeam[side];
  const team = teamRecord(teamKey);
  panel.querySelector(`[data-team-name="${side}"]`).textContent = team.name;
  panel.querySelector(`[data-coach="${side}"]`).textContent = team.coach;
  panel.querySelector(`[data-seed="${side}"]`).textContent = team.seed;
  panel.querySelector(`[data-pick-order="${side}"]`).textContent = pickOrderLabel(
    resolved.teamToPickOrder[teamKey],
  );

  const rosterHost = panel.querySelector(`[data-roster="${side}"]`);
  rosterHost.innerHTML = team.roster
    .map(
      (entry) => `
        <article class="roster-item">
          <div>
            <span class="roster-role">${entry.role}</span>
            <p class="roster-name">${entry.player}</p>
          </div>
          <span>${sideLabel(side)}</span>
        </article>
      `,
    )
    .join("");
}

function renderPhaseTrack() {
  const resolved = assignments();
  dom.phaseTrack.innerHTML = store.sequence
    .map((step, index) => {
      const actingTeamKey = resolved.pickOrderToTeam[step.order];
      const actingSide = resolved.teamToSide[actingTeamKey];
      const stateLabel = index < store.live.turnIndex ? "done" : index === store.live.turnIndex ? "active" : "pending";
      return `
        <button class="phase-chip" type="button" data-state="${stateLabel}" data-team="${actingSide}" data-turn-index="${index}">
          <div class="phase-chip__meta">
            <span>#${String(step.turn).padStart(2, "0")}</span>
            <span class="phase-chip__team">${actingSide}</span>
          </div>
          <strong class="phase-chip__title">${step.label}</strong>
          <span class="phase-chip__copy">${pickOrderLabel(step.order)} · ${step.type} slot ${step.slot + 1}</span>
        </button>
      `;
    })
    .join("");
}

function renderPickStack(side) {
  const resolved = assignments();
  const team = teamRecord(resolved.sideToTeam[side]);
  const host = side === "blue" ? dom.bluePickStack : dom.redPickStack;
  host.innerHTML = team.picks
    .map((pick) => {
      const visualState = slotState(pick.turn);
      const champion = visualState === "pending" ? "Hidden" : pick.champion;
      const caption =
        visualState === "pending"
          ? "Awaiting reveal"
          : visualState === "active"
            ? "On the clock"
            : "Locked in";
      return `
        <article class="pick-card" data-team="${side}" data-state="${visualState}">
          <div class="pick-card__left">
            <span class="pick-role">${pick.role.slice(0, 3).toUpperCase()}</span>
            <div class="pick-copy">
              <strong class="pick-name">${champion}</strong>
              <span class="pick-player">${pick.player}</span>
            </div>
          </div>
          <span class="pick-card__state">${caption}</span>
        </article>
      `;
    })
    .join("");
}

function renderBanStrip(side) {
  const resolved = assignments();
  const team = teamRecord(resolved.sideToTeam[side]);
  const host = side === "blue" ? dom.blueBanStrip : dom.redBanStrip;
  host.innerHTML = team.bans
    .map((ban) => {
      const visualState = slotState(ban.turn);
      return `
        <article class="ban-slot" data-team="${side}" data-state="${visualState}">
          <span class="ban-slot__team">${side}</span>
          <strong class="ban-slot__name">${visualState === "pending" ? "Open ban" : ban.champion}</strong>
          <span class="ban-slot__state">${visualState}</span>
        </article>
      `;
    })
    .join("");
}

function renderFearless(side) {
  const resolved = assignments();
  const host = side === "blue" ? dom.blueFearless : dom.redFearless;
  const team = teamRecord(resolved.sideToTeam[side]);
  host.dataset.team = side;
  host.innerHTML = `
    <div class="fearless-column__header">
      <strong class="fearless-column__team">${team.name}</strong>
      <span class="eyebrow">${team.fearless.length} locked champions</span>
    </div>
    <div class="fearless-grid">
      ${team.fearless
        .map(
          (item) => `
            <article class="fearless-item">
              <div class="fearless-item__copy">
                <span class="fearless-item__label">${item.game} ${item.role}</span>
                <strong>${item.champion}</strong>
              </div>
              <span class="fearless-item__turn">${item.game.replace("G", "")}</span>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderCurrentStep() {
  const resolved = assignments();
  const step = currentStep();
  const teamKey = resolved.pickOrderToTeam[step.order];
  const side = resolved.teamToSide[teamKey];
  const team = teamRecord(teamKey);
  const slotData = step.type === "pick" ? team.picks[step.slot] : team.bans[step.slot];

  dom.phaseTitle.textContent = `${team.name} ${step.label}`;
  dom.phaseCounter.textContent = `${step.turn} / ${store.sequence.length}`;
  dom.liveState.innerHTML = store.live.running ? '<span class="live-chip">live</span>' : "paused";
  dom.timerValue.textContent = formatSeconds(store.live.remainingMs);
  dom.activeTeam.textContent = team.name;
  dom.activeCopy.textContent = step.prompt;
  dom.activeRole.textContent = step.type === "pick" && slotData.role ? `${slotData.role} lane` : sideLabel(side);
  dom.activeKind.textContent = `${pickOrderLabel(step.order)} · ${step.type} slot ${step.slot + 1}`;
}

function render() {
  renderMeta();
  renderTeamPanel("blue");
  renderTeamPanel("red");
  renderPhaseTrack();
  renderPickStack("blue");
  renderPickStack("red");
  renderBanStrip("blue");
  renderBanStrip("red");
  renderFearless("blue");
  renderFearless("red");
  renderCurrentStep();
}

function persistStore() {
  store = draftStore.saveStore(store);
}

function jumpToTurn(nextIndex, persist) {
  store = draftStore.jumpToTurn(store, nextIndex);
  render();
  if (persist) {
    persistStore();
  }
}

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

    if (turnChanged) {
      renderPhaseTrack();
      renderPickStack("blue");
      renderPickStack("red");
      renderBanStrip("blue");
      renderBanStrip("red");
      renderCurrentStep();
    } else if (secondsChanged || runningChanged) {
      renderCurrentStep();
    }
  }

  window.requestAnimationFrame(animate);
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
    return;
  }
  document.documentElement.requestFullscreen().catch(() => {});
}

function resetCurrentTimer() {
  store.live.remainingMs = currentStep().duration * 1000;
  renderCurrentStep();
  persistStore();
}

function handleKeydown(event) {
  if (event.key === "ArrowRight") {
    jumpToTurn(store.live.turnIndex + 1, true);
  } else if (event.key === "ArrowLeft") {
    jumpToTurn(store.live.turnIndex - 1, true);
  } else if (event.key.toLowerCase() === "r") {
    resetCurrentTimer();
  } else if (event.key === " ") {
    event.preventDefault();
    store.live.running = !store.live.running;
    renderCurrentStep();
    persistStore();
  } else if (event.key.toLowerCase() === "f") {
    toggleFullscreen();
  }
}

function renderGameToText() {
  const resolved = assignments();
  const step = currentStep();
  const actingTeamKey = resolved.pickOrderToTeam[step.order];
  const payload = {
    view: "broadcast-wireframe",
    note: "origin at top-left, x grows right, y grows down",
    title: store.broadcast.title,
    live: store.live.running,
    turn: step.turn,
    phase: `${teamRecord(actingTeamKey).name} ${step.label}`,
    timer_seconds: Math.ceil(store.live.remainingMs / 1000),
    active_team: teamRecord(actingTeamKey).name,
    active_type: step.type,
    blue_side_team: teamBySide("blue").name,
    red_side_team: teamBySide("red").name,
    first_pick_team: teamByPickOrder("first").name,
    second_pick_team: teamByPickOrder("second").name,
    selection_priority_team: teamRecord(resolved.priorityTeam).name,
    selection_priority_pick_order: store.selection.priorityChoiceValue,
    selection_counter_team: teamRecord(resolved.otherTeam).name,
    selection_counter_side: store.selection.counterChoiceValue,
    blue_locked_picks: teamBySide("blue").picks
      .filter((pick) => pick.turn < step.turn)
      .map((pick) => pick.champion),
    red_locked_picks: teamBySide("red").picks
      .filter((pick) => pick.turn < step.turn)
      .map((pick) => pick.champion),
    blue_locked_bans: teamBySide("blue").bans
      .filter((ban) => ban.turn < step.turn)
      .map((ban) => ban.champion),
    red_locked_bans: teamBySide("red").bans
      .filter((ban) => ban.turn < step.turn)
      .map((ban) => ban.champion),
  };
  return JSON.stringify(payload);
}

window.render_game_to_text = renderGameToText;
window.advanceTime = (milliseconds) => {
  const wasRunning = store.live.running;
  const steppedStore = draftStore.clone(store);
  steppedStore.live.running = true;
  store = draftStore.stepLive(steppedStore, milliseconds);
  store.live.running = wasRunning;
  render();
};
window.resetWireframe = () => {
  store = draftStore.resetStore();
  lastTick = performance.now();
  render();
};

document.addEventListener("keydown", handleKeydown);
dom.phaseTrack.addEventListener("click", (event) => {
  const button = event.target.closest("[data-turn-index]");
  if (!button) {
    return;
  }

  jumpToTurn(Number(button.dataset.turnIndex), true);
});

draftStore.subscribe((nextStore) => {
  store = nextStore;
  lastTick = performance.now();
  render();
});

render();
window.requestAnimationFrame(animate);
