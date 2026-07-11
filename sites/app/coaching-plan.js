function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function nonEmptyString(value) {
  return typeof value === "string" ? value.trim() : "";
}

const PHASES = [
  { key: "early", phase: "EARLY", label: "초반" },
  { key: "mid", phase: "MID", label: "중반" },
  { key: "late", phase: "LATE", label: "후반" },
];

function finiteNumberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatClock(ms) {
  const value = finiteNumberOrNull(ms);
  if (value == null) return "";
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function normalizedPhaseName(value) {
  const name = nonEmptyString(value);
  const aliases = {
    early: "EARLY", EARLY: "EARLY", 초반: "EARLY",
    mid: "MID", MID: "MID", 중반: "MID",
    late: "LATE", LATE: "LATE", 후반: "LATE",
  };
  return aliases[name] || aliases[name.toUpperCase()] || "";
}

const SKILL_CATEGORIES = [
  ["combat", "전투"],
  ["income", "수급"],
  ["vision", "시야"],
  ["survival", "생존"],
  ["objective", "오브젝트"],
  ["structure", "구조물"],
];

function normalizedScore(value) {
  const isNumber = typeof value === "number";
  const isNumericString = typeof value === "string" && value.trim() !== "";
  if (!isNumber && !isNumericString) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(Math.min(10, Math.max(0, number)) * 10) / 10;
}

function uniqueEventIds(value) {
  return [...new Set(asArray(value).map(nonEmptyString).filter(Boolean))];
}

function actionCopy(action) {
  if (!action || typeof action !== "object") return "";
  return nonEmptyString(action.text)
    || [nonEmptyString(action.title), nonEmptyString(action.description || action.detail)]
      .filter(Boolean)
      .join(" — ");
}

export function buildFocusModel(analysis) {
  const weakness = asArray(analysis?.weaknesses)[0];
  const actions = asArray(analysis?.actionChecklist);
  const weaknessId = nonEmptyString(weakness?.id);
  const action = actions.find(
    (entry) => weaknessId && nonEmptyString(entry?.linkedWeaknessId) === weaknessId,
  ) || actions[0];
  const title = nonEmptyString(weakness?.title);
  const description = nonEmptyString(weakness?.description);
  const actionText = actionCopy(action);
  if (![title, description, actionText].some(Boolean)) return null;

  const relatedEventIds = uniqueEventIds(weakness?.relatedEventIds);
  return {
    weaknessId,
    title,
    description,
    actionId: nonEmptyString(action?.id),
    actionText,
    relatedEventIds,
    evidenceCount: relatedEventIds.length,
  };
}

export function findFocusMomentId(focus, moments) {
  const targetIds = new Set(uniqueEventIds(focus?.relatedEventIds));
  if (targetIds.size === 0) return "";
  const match = asArray(moments).find((moment) =>
    uniqueEventIds(moment?.relatedEventIds).some((eventId) => targetIds.has(eventId)));
  return nonEmptyString(match?.id);
}

export function buildPhaseModels(normalized, analysis) {
  const summaries = asArray(analysis?.phaseSummaries);
  return PHASES.map(({ key, phase, label }) => {
    const context = normalized?.phaseContext?.[key];
    const hasContext = Boolean(
      context
      && typeof context === "object"
      && Object.keys(context).length > 0,
    );
    const start = formatClock(context?.startMs);
    const end = formatClock(context?.endMs);
    const summary = summaries.find(
      (entry) => normalizedPhaseName(entry?.phase) === phase,
    );
    return {
      key,
      phase,
      label,
      timeRange: hasContext
        ? (start && end ? `${start}–${end}` : start || end || "시간 정보 없음")
        : "",
      kills: hasContext ? finiteNumberOrNull(context?.kills) : null,
      deaths: hasContext ? finiteNumberOrNull(context?.deaths) : null,
      assists: hasContext ? finiteNumberOrNull(context?.assists) : null,
      notableEventCount: hasContext
        ? finiteNumberOrNull(context?.notableEventCount)
        : null,
      summary: hasContext
        ? nonEmptyString(summary?.summary) || "이 구간의 AI 요약이 없습니다."
        : "",
      hasContext,
    };
  });
}

export function buildSkillProfile(normalized) {
  const score = normalized?.playtimeScore;
  const categories = score?.categories;
  return {
    overall: normalizedScore(score?.overall),
    label: nonEmptyString(score?.label),
    categories: SKILL_CATEGORIES.map(([key, label]) => {
      const value = normalizedScore(categories?.[key]);
      return {
        key,
        label,
        value,
        displayValue: value == null ? "측정 없음" : value.toFixed(1),
      };
    }),
  };
}
