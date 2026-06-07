#!/usr/bin/env node

import { pathToFileURL } from "node:url";

function ipv4Parts(host) {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  return parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
}

function isPrivateOrLocalIpv4(host) {
  const parts = ipv4Parts(host);
  if (!parts) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function mappedIpv4PartsFromIpv6(host) {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  const match = normalized.match(/^::ffff:(?:0:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!match) return null;
  const high = Number.parseInt(match[1], 16);
  const low = Number.parseInt(match[2], 16);
  if (!Number.isInteger(high) || !Number.isInteger(low) || high > 0xffff || low > 0xffff) return null;
  return [high >> 8, high & 0xff, low >> 8, low & 0xff];
}

function isPrivateOrLocalIpv6(host) {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  const mappedIpv4Parts = mappedIpv4PartsFromIpv6(normalized);
  if (mappedIpv4Parts) {
    return isPrivateOrLocalIpv4(mappedIpv4Parts.join("."));
  }
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

function isIpLiteralHost(host) {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  return Boolean(ipv4Parts(host)) || normalized.includes(":");
}

function isSingleLabelHostname(host) {
  return !isIpLiteralHost(host) && !host.includes(".");
}

function isLocalOrPrivateHost(host) {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    isPrivateOrLocalIpv4(host) ||
    isPrivateOrLocalIpv6(host)
  );
}

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
  if (isLocalOrPrivateHost(host)) {
    throw new Error(`${safeLabel} must not point to a local or private network target`);
  }
  if (isSingleLabelHostname(host)) {
    throw new Error(`${safeLabel} must use a fully qualified public hostname or IP address`);
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
