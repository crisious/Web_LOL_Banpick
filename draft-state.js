(function draftStateModule(global) {
  const STORAGE_KEY = "lol-banpick-broadcast-state";

  const DEFAULT_STORE = {
    broadcast: {
      title: "Fearless Draft Wireframe",
      subtitle: "Broadcast layout study for a live League of Legends draft show.",
    },
    series: {
      patch: "26.05",
      format: "Fearless Bo5",
      gameLabel: "Game 3",
      firstSelection: "First selection: T1",
    },
    teams: {
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
    },
    sequence: [
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
    ],
    live: {
      turnIndex: 16,
      remainingMs: 35000,
      running: true,
    },
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function mergeWithDefaults(base, incoming) {
    if (Array.isArray(base)) {
      return Array.isArray(incoming) ? clone(incoming) : clone(base);
    }

    if (isObject(base)) {
      const result = {};
      const source = isObject(incoming) ? incoming : {};
      const keys = new Set([...Object.keys(base), ...Object.keys(source)]);
      keys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(base, key)) {
          result[key] = mergeWithDefaults(base[key], source[key]);
        } else {
          result[key] = clone(source[key]);
        }
      });
      return result;
    }

    return incoming === undefined ? base : incoming;
  }

  function clampNumber(value, minimum, maximum, fallback) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return fallback;
    }
    return Math.min(maximum, Math.max(minimum, value));
  }

  function normalizeStore(rawStore) {
    const store = mergeWithDefaults(DEFAULT_STORE, rawStore);
    const maxTurnIndex = Math.max(0, store.sequence.length - 1);

    store.live.turnIndex = clampNumber(
      store.live.turnIndex,
      0,
      maxTurnIndex,
      DEFAULT_STORE.live.turnIndex,
    );

    const fallbackRemaining =
      (store.sequence[store.live.turnIndex] && store.sequence[store.live.turnIndex].duration * 1000) ||
      30000;

    store.live.remainingMs = clampNumber(
      store.live.remainingMs,
      0,
      Number.MAX_SAFE_INTEGER,
      fallbackRemaining,
    );
    store.live.running = Boolean(store.live.running);

    ["blue", "red"].forEach((teamKey) => {
      const team = store.teams[teamKey];
      team.score = clampNumber(team.score, 0, 99, 0);
      team.roster = Array.isArray(team.roster) ? team.roster : [];
      team.picks = Array.isArray(team.picks) ? team.picks : [];
      team.bans = Array.isArray(team.bans) ? team.bans : [];
      team.fearless = Array.isArray(team.fearless) ? team.fearless : [];
    });

    return store;
  }

  function readStorage() {
    try {
      return global.localStorage;
    } catch (error) {
      return null;
    }
  }

  function createDefaultStore() {
    return clone(DEFAULT_STORE);
  }

  function loadStore() {
    const storage = readStorage();
    if (!storage) {
      return createDefaultStore();
    }

    try {
      const rawValue = storage.getItem(STORAGE_KEY);
      if (!rawValue) {
        return createDefaultStore();
      }
      return normalizeStore(JSON.parse(rawValue));
    } catch (error) {
      return createDefaultStore();
    }
  }

  function saveStore(nextStore) {
    const normalized = normalizeStore(nextStore);
    const storage = readStorage();
    if (storage) {
      storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
    return clone(normalized);
  }

  function resetStore() {
    return saveStore(createDefaultStore());
  }

  function subscribe(callback) {
    function handleStorage(event) {
      if (event.key !== STORAGE_KEY) {
        return;
      }
      callback(loadStore());
    }

    global.addEventListener("storage", handleStorage);
    return function unsubscribe() {
      global.removeEventListener("storage", handleStorage);
    };
  }

  function getCurrentStep(store) {
    return store.sequence[store.live.turnIndex];
  }

  function formatTimer(milliseconds) {
    const safeValue = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(safeValue / 60);
    const seconds = safeValue % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function jumpToTurn(store, nextIndex) {
    const nextStore = normalizeStore(store);
    nextStore.live.turnIndex = clampNumber(nextIndex, 0, nextStore.sequence.length - 1, 0);
    nextStore.live.remainingMs = nextStore.sequence[nextStore.live.turnIndex].duration * 1000;
    return nextStore;
  }

  function stepLive(store, milliseconds) {
    const nextStore = normalizeStore(store);
    if (!nextStore.live.running) {
      return nextStore;
    }

    let remaining = Math.max(0, milliseconds);
    while (remaining > 0) {
      if (nextStore.live.remainingMs > remaining) {
        nextStore.live.remainingMs -= remaining;
        break;
      }

      remaining -= nextStore.live.remainingMs;
      if (nextStore.live.turnIndex >= nextStore.sequence.length - 1) {
        nextStore.live.remainingMs = 0;
        nextStore.live.running = false;
        break;
      }

      nextStore.live.turnIndex += 1;
      nextStore.live.remainingMs = nextStore.sequence[nextStore.live.turnIndex].duration * 1000;
    }

    return nextStore;
  }

  global.LolDraftState = {
    STORAGE_KEY,
    createDefaultStore,
    loadStore,
    saveStore,
    resetStore,
    subscribe,
    getCurrentStep,
    formatTimer,
    jumpToTurn,
    stepLive,
    clone,
  };
})(window);
