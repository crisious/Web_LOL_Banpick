export function redactUrlForEvidence(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.username && !parsed.password && !parsed.search && !parsed.hash) {
      return rawUrl;
    }
    parsed.username = "";
    parsed.password = "";
    if (parsed.search) parsed.search = "?redacted";
    if (parsed.hash) parsed.hash = "#redacted";
    return parsed.toString();
  } catch {
    return "<redacted-invalid-url>";
  }
}
