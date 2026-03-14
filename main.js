const seriesData = {
  patch: "26.05",
  format: "Fearless Bo5",
  gameLabel: "Game 3",
  firstSelection: "First selection: T1",
  blue: {
    name: "T1",
    score: 1,
    coach: "Tom",
    seed: "LCK #2",
    roster: [
      { role: "Top", player: "Doran" },
      { role: "Jungle", player: "Oner" },
      { role: "Mid", player: "Faker" },
      { role: "Bot", player: "Gumayusi" },
      { role: "Support", player: "Keria" },
    ],
    picks: [
      { champion: "Azir", role: "Mid", player: "Faker", turn: 7 },
      { champion: "Vi", role: "Jungle", player: "Oner", turn: 10 },
      { champion: "Rell", role: "Support", player: "Keria", turn: 11 },
      { champion: "Jhin", role: "Bot", player: "Gumayusi", turn: 18 },
      { champion: "Gnar", role: "Top", player: "Doran", turn: 19 },
    ],
    bans: [
      { champion: "Kalista", turn: 1 },
      { champion: "Maokai", turn: 3 },
      { champion: "Aurora", turn: 5 },
      { champion: "Nautilus", turn: 14 },
      { champion: "Renata", turn: 16 },
    ],
    fearless: [
      { champion: "Corki", role: "Mid", game: "G1" },
      { champion: "Xin Zhao", role: "Jungle", game: "G1" },
      { champion: "KaiSa", role: "Bot", game: "G1" },
      { champion: "Galio", role: "Mid", game: "G2" },
      { champion: "Varus", role: "Bot", game: "G2" },
      { champion: "Alistar", role: "Support", game: "G2" },
    ],
  },
  red: {
    name: "GEN",
    score: 1,
    coach: "Mata",
    seed: "LCK #1",
    roster: [
      { role: "Top", player: "Kiin" },
      { role: "Jungle", player: "Canyon" },
      { role: "Mid", player: "Chovy" },
      { role: "Bot", player: "Ruler" },
      { role: "Support", player: "Duro" },
    ],
    picks: [
      { champion: "Poppy", role: "Top", player: "Kiin", turn: 8 },
      { champion: "Sejuani", role: "Jungle", player: "Canyon", turn: 9 },
      { champion: "Orianna", role: "Mid", player: "Chovy", turn: 12 },
      { champion: "Ezreal", role: "Bot", player: "Ruler", turn: 17 },
      { champion: "Braum", role: "Support", player: "Duro", turn: 20 },
    ],
    bans: [
      { champion: "Yone", turn: 2 },
      { champion: "Skarner", turn: 4 },
      { champion: "Pantheon", turn: 6 },
      { champion: "Leona", turn: 13 },
      { champion: "Poppy", turn: 15 },
    ],
    fearless: [
      { champion: "Taliyah", role: "Mid", game: "G1" },
      { champion: "Rumble", role: "Top", game: "G1" },
      { champion: "Senna", role: "Bot", game: "G1" },
      { champion: "Smolder", role: "Bot", game: "G2" },
      { champion: "Wukong", role: "Jungle", game: "G2" },
      { champion: "Neeko", role: "Mid", game: "G2" },
    ],
  },
};

const sequence = [
  { turn: 1, team: "blue", type: "ban", slot: 0, label: "Ban 1", prompt: "Remove a comfort opener.", duration: 28 },
  { turn: 2, team: "red", type: "ban", slot: 0, label: "Ban 1", prompt: "Answer the opener.", duration: 28 },
  { turn: 3, team: "blue", type: "ban", slot: 1, label: "Ban 2", prompt: "Pressure the jungle pool.", duration: 28 },
  { turn: 4, team: "red", type: "ban", slot: 1, label: "Ban 2", prompt: "Push a lane ban trade.", duration: 28 },
  { turn: 5, team: "blue", type: "ban", slot: 2, label: "Ban 3", prompt: "Shape the first rotation.", duration: 28 },
  { turn: 6, team: "red", type: "ban", slot: 2, label: "Ban 3", prompt: "Protect the side selection.", duration: 28 },
  { turn: 7, team: "blue", type: "pick", slot: 0, label: "Pick 1", prompt: "Secure the priority mid lane.", duration: 35 },
  { turn: 8, team: "red", type: "pick", slot: 0, label: "Pick 1", prompt: "Start the front line answer.", duration: 35 },
  { turn: 9, team: "red", type: "pick", slot: 1, label: "Pick 2", prompt: "Pair engage with tempo.", duration: 35 },
  { turn: 10, team: "blue", type: "pick", slot: 1, label: "Pick 2", prompt: "Lock the jungle bridge.", duration: 35 },
  { turn: 11, team: "blue", type: "pick", slot: 2, label: "Pick 3", prompt: "Finish the support shell.", duration: 35 },
  { turn: 12, team: "red", type: "pick", slot: 2, label: "Pick 3", prompt: "Reveal the scaling core.", duration: 35 },
  { turn: 13, team: "red", type: "ban", slot: 3, label: "Ban 4", prompt: "Target the bot lane pool.", duration: 28 },
  { turn: 14, team: "blue", type: "ban", slot: 3, label: "Ban 4", prompt: "Deny hard engage follow-up.", duration: 28 },
  { turn: 15, team: "red", type: "ban", slot: 4, label: "Ban 5", prompt: "Force the top lane blind.", duration: 28 },
  { turn: 16, team: "blue", type: "ban", slot: 4, label: "Ban 5", prompt: "Close the support counter pool.", duration: 28 },
  { turn: 17, team: "red", type: "pick", slot: 3, label: "Pick 4", prompt: "Commit to long range damage.", duration: 35 },
  { turn: 18, team: "blue", type: "pick", slot: 3, label: "Pick 4", prompt: "Match lane pressure.", duration: 35 },
  { turn: 19, team: "blue", type: "pick", slot: 4, label: "Pick 5", prompt: "Hold the final counter pick.", duration: 35 },
  { turn: 20, team: "red", type: "pick", slot: 4, label: "Pick 5", prompt: "Round out the composition.", duration: 35 },
];

const state = {
  turnIndex: 16,
  remainingMs: sequence[16].duration * 1000,
  running: true,
};

const dom = {
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
  firstSelection: document.querySelector("[data-first-selection]"),
};

function currentStep() {
  return sequence[state.turnIndex];
}

function formatSeconds(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
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
  document.querySelector('[data-score-name="blue"]').textContent = seriesData.blue.name;
  document.querySelector('[data-score-name="red"]').textContent = seriesData.red.name;
  document.querySelector('[data-score="blue"]').textContent = seriesData.blue.score;
  document.querySelector('[data-score="red"]').textContent = seriesData.red.score;
  dom.seriesFormat.textContent = seriesData.format;
  dom.seriesGame.textContent = seriesData.gameLabel;
  dom.firstSelection.textContent = seriesData.firstSelection;
  dom.patchVersion.textContent = seriesData.patch;
}

function renderTeamPanel(teamKey) {
  const panel = teamKey === "blue" ? dom.bluePanel : dom.redPanel;
  const team = seriesData[teamKey];
  panel.querySelector(`[data-team-name="${teamKey}"]`).textContent = team.name;
  panel.querySelector(`[data-coach="${teamKey}"]`).textContent = team.coach;
  panel.querySelector(`[data-seed="${teamKey}"]`).textContent = team.seed;

  const rosterHost = panel.querySelector(`[data-roster="${teamKey}"]`);
  rosterHost.innerHTML = team.roster
    .map(
      (entry) => `
        <article class="roster-item">
          <div>
            <span class="roster-role">${entry.role}</span>
            <p class="roster-name">${entry.player}</p>
          </div>
          <span>${teamKey === "blue" ? "Blue" : "Red"}</span>
        </article>
      `,
    )
    .join("");
}

function renderPhaseTrack() {
  dom.phaseTrack.innerHTML = sequence
    .map((step, index) => {
      const stateLabel = index < state.turnIndex ? "done" : index === state.turnIndex ? "active" : "pending";
      return `
        <button class="phase-chip" type="button" data-state="${stateLabel}" data-team="${step.team}" data-turn-index="${index}">
          <div class="phase-chip__meta">
            <span>#${String(step.turn).padStart(2, "0")}</span>
            <span class="phase-chip__team">${step.team}</span>
          </div>
          <strong class="phase-chip__title">${step.label}</strong>
          <span class="phase-chip__copy">${step.type} slot ${step.slot + 1}</span>
        </button>
      `;
    })
    .join("");
}

function renderPickStack(teamKey) {
  const team = seriesData[teamKey];
  const host = teamKey === "blue" ? dom.bluePickStack : dom.redPickStack;
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
        <article class="pick-card" data-team="${teamKey}" data-state="${visualState}">
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

function renderBanStrip(teamKey) {
  const team = seriesData[teamKey];
  const host = teamKey === "blue" ? dom.blueBanStrip : dom.redBanStrip;
  host.innerHTML = team.bans
    .map((ban) => {
      const visualState = slotState(ban.turn);
      return `
        <article class="ban-slot" data-team="${teamKey}" data-state="${visualState}">
          <span class="ban-slot__team">${teamKey}</span>
          <strong class="ban-slot__name">${visualState === "pending" ? "Open ban" : ban.champion}</strong>
          <span class="ban-slot__state">${visualState}</span>
        </article>
      `;
    })
    .join("");
}

function renderFearless(teamKey) {
  const host = teamKey === "blue" ? dom.blueFearless : dom.redFearless;
  const team = seriesData[teamKey];
  host.dataset.team = teamKey;
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
  const step = currentStep();
  const team = seriesData[step.team];
  const slotData = step.type === "pick" ? team.picks[step.slot] : team.bans[step.slot];

  dom.phaseTitle.textContent = `${team.name} ${step.label}`;
  dom.phaseCounter.textContent = `${step.turn} / ${sequence.length}`;
  dom.liveState.innerHTML = state.running ? '<span class="live-chip">live</span>' : "paused";
  dom.timerValue.textContent = formatSeconds(state.remainingMs);
  dom.activeTeam.textContent = team.name;
  dom.activeCopy.textContent = step.prompt;
  dom.activeRole.textContent = step.type === "pick" ? `${slotData.role} lane` : "team strategy";
  dom.activeKind.textContent = `${step.type} slot ${step.slot + 1}`;
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

function jumpToTurn(nextIndex) {
  state.turnIndex = Math.max(0, Math.min(sequence.length - 1, nextIndex));
  state.remainingMs = sequence[state.turnIndex].duration * 1000;
  render();
}

function stepDraft(ms) {
  if (!state.running) {
    return;
  }

  let remaining = ms;
  while (remaining > 0) {
    const step = currentStep();
    if (state.remainingMs > remaining) {
      state.remainingMs -= remaining;
      return;
    }

    remaining -= state.remainingMs;
    if (state.turnIndex === sequence.length - 1) {
      state.remainingMs = 0;
      state.running = false;
      return;
    }

    state.turnIndex += 1;
    state.remainingMs = sequence[state.turnIndex].duration * 1000;
  }
}

let lastTick = performance.now();
function animate(now) {
  const delta = Math.min(250, now - lastTick);
  lastTick = now;
  if (state.running) {
    stepDraft(delta);
    renderCurrentStep();
    renderPhaseTrack();
    renderPickStack("blue");
    renderPickStack("red");
    renderBanStrip("blue");
    renderBanStrip("red");
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

function handleKeydown(event) {
  if (event.key === "ArrowRight") {
    jumpToTurn(state.turnIndex + 1);
  } else if (event.key === "ArrowLeft") {
    jumpToTurn(state.turnIndex - 1);
  } else if (event.key.toLowerCase() === "r") {
    jumpToTurn(state.turnIndex);
  } else if (event.key === " ") {
    event.preventDefault();
    state.running = !state.running;
    renderCurrentStep();
  } else if (event.key.toLowerCase() === "f") {
    toggleFullscreen();
  }
}

function renderGameToText() {
  const step = currentStep();
  const payload = {
    view: "broadcast-wireframe",
    note: "origin at top-left, x grows right, y grows down",
    live: state.running,
    turn: step.turn,
    phase: `${seriesData[step.team].name} ${step.label}`,
    timer_seconds: Math.ceil(state.remainingMs / 1000),
    active_team: seriesData[step.team].name,
    active_type: step.type,
    blue_locked_picks: seriesData.blue.picks.filter((pick) => pick.turn < step.turn).map((pick) => pick.champion),
    red_locked_picks: seriesData.red.picks.filter((pick) => pick.turn < step.turn).map((pick) => pick.champion),
    blue_locked_bans: seriesData.blue.bans.filter((ban) => ban.turn < step.turn).map((ban) => ban.champion),
    red_locked_bans: seriesData.red.bans.filter((ban) => ban.turn < step.turn).map((ban) => ban.champion),
  };
  return JSON.stringify(payload);
}

window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => {
  const wasRunning = state.running;
  state.running = true;
  stepDraft(ms);
  state.running = wasRunning;
  render();
};
window.resetWireframe = () => {
  state.turnIndex = 16;
  state.remainingMs = sequence[16].duration * 1000;
  state.running = true;
  render();
};

document.addEventListener("keydown", handleKeydown);
dom.phaseTrack.addEventListener("click", (event) => {
  const button = event.target.closest("[data-turn-index]");
  if (!button) {
    return;
  }

  jumpToTurn(Number(button.dataset.turnIndex));
});
render();
window.requestAnimationFrame(animate);
