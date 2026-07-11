function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function nonEmptyString(value) {
  return typeof value === "string" ? value.trim() : "";
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
