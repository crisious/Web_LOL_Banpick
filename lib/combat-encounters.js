const COMBAT_ENCOUNTER_WINDOW_MS = 25_000;
const COMBAT_ENCOUNTER_MAX = 24;

const PLAYER_KILL_EVENT_TYPES = new Set(["CHAMPION_KILL"]);
const PLAYER_DEATH_EVENT_TYPES = new Set(["PLAYER_DEATH"]);
const PLAYER_COMBAT_EVENT_TYPES = new Set([
  ...PLAYER_KILL_EVENT_TYPES,
  ...PLAYER_DEATH_EVENT_TYPES,
]);

function eventTimestampMs(event) {
  const timestampMs = event?.timestampMs;
  return Number.isFinite(timestampMs) && timestampMs >= 0 ? timestampMs : 0;
}

function timestampLabel(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = String(totalSeconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function phaseFor(timestampMs) {
  if (timestampMs <= 900_000) return "EARLY";
  if (timestampMs <= 1_800_000) return "MID";
  return "LATE";
}

function resolvedWindowMs(value) {
  return Number.isFinite(value) && value >= 0
    ? value
    : COMBAT_ENCOUNTER_WINDOW_MS;
}

function resolvedMaxEncounters(value) {
  if (value === Number.POSITIVE_INFINITY) return value;
  return Number.isInteger(value) && value >= 0
    ? value
    : COMBAT_ENCOUNTER_MAX;
}

function detectCombatEncounters(timelineEvents, options = {}) {
  const windowMs = resolvedWindowMs(options.windowMs);
  const maxEncounters = resolvedMaxEncounters(options.maxEncounters);
  const combatEvents = timelineEvents
    .filter((event) => PLAYER_COMBAT_EVENT_TYPES.has(event.eventType))
    .sort((a, b) => eventTimestampMs(a) - eventTimestampMs(b));

  const groups = [];
  let current = null;
  for (const event of combatEvents) {
    const timestampMs = eventTimestampMs(event);
    if (!current || timestampMs - current.lastMs > windowMs) {
      current = { events: [event], firstMs: timestampMs, lastMs: timestampMs };
      groups.push(current);
    } else {
      current.events.push(event);
      current.lastMs = timestampMs;
    }
  }

  const encounters = [];
  for (const group of groups) {
    if (!group.events.some((event) => event.isPlayerInvolved)) continue;

    let playerKills = 0;
    let playerDeaths = 0;
    for (const event of group.events) {
      if (!event.isPlayerInvolved) continue;
      if (PLAYER_KILL_EVENT_TYPES.has(event.eventType)) playerKills += 1;
      else if (PLAYER_DEATH_EVENT_TYPES.has(event.eventType)) playerDeaths += 1;
    }

    let situation = "TRADED";
    if (playerKills > playerDeaths) situation = "PLAYER_DOMINANT";
    else if (playerDeaths > playerKills) situation = "PLAYER_DOWN";

    encounters.push({
      encounterId: `enc_${String(encounters.length + 1).padStart(3, "0")}`,
      phase: phaseFor(group.firstMs),
      startLabel: timestampLabel(group.firstMs),
      endLabel: timestampLabel(group.lastMs),
      eventCount: group.events.length,
      playerKills,
      playerDeaths,
      situation,
      relatedEventIds: group.events.map((event) => event.eventId),
    });
    if (encounters.length >= maxEncounters) break;
  }

  return encounters;
}

module.exports = {
  COMBAT_ENCOUNTER_MAX,
  COMBAT_ENCOUNTER_WINDOW_MS,
  detectCombatEncounters,
};
