#!/usr/bin/env node

import { pathToFileURL } from "node:url";

export function validateExternalSmokeUrl(label, rawUrl) {
  const safeLabel = label && !String(label).startsWith("--") ? String(label) : "external_url";
  const value = String(rawUrl || "").trim();
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${safeLabel} needs an https:// URL`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${safeLabel} needs an https:// URL`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${safeLabel} must not include username/password, query string, or fragment`);
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]" || host.endsWith(".localhost")) {
    throw new Error(`${safeLabel} must not point to localhost or loopback`);
  }
  return parsed.toString();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const label = process.argv[2] || "external_url";
  const rawUrl = process.argv[3] || "";
  try {
    const normalizedUrl = validateExternalSmokeUrl(label, rawUrl);
    console.log(`OK ${label} ${normalizedUrl}`);
  } catch (error) {
    console.error(`FAIL ${error.message || error}`);
    process.exit(1);
  }
}
