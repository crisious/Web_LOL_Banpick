#!/usr/bin/env node

import { pathToFileURL } from "node:url";

function ipv4Parts(host) {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  return parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
}

function rawHostFromUrlValue(value) {
  const withoutScheme = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const authority = withoutScheme.split(/[/?#]/, 1)[0] || "";
  const hostPort = authority.includes("@") ? authority.slice(authority.lastIndexOf("@") + 1) : authority;
  if (hostPort.startsWith("[")) {
    const closingBracketIndex = hostPort.indexOf("]");
    return closingBracketIndex >= 0 ? hostPort.slice(0, closingBracketIndex + 1).toLowerCase() : hostPort.toLowerCase();
  }
  return hostPort.split(":")[0].toLowerCase();
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

function isReservedOrSpecialIpv4(host) {
  const parts = ipv4Parts(host);
  if (!parts) return false;
  const [a, b, c] = parts;
  return (
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 31 && c === 196) ||
    (a === 192 && b === 52 && c === 193) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 175 && c === 48) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
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

function ipv6Hextets(host) {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!normalized.includes(":")) return null;
  const compressedParts = normalized.split("::");
  if (compressedParts.length > 2) return null;
  const head = compressedParts[0] ? compressedParts[0].split(":") : [];
  const tail = compressedParts.length === 2 && compressedParts[1] ? compressedParts[1].split(":") : [];
  const missingCount = compressedParts.length === 2 ? 8 - head.length - tail.length : 0;
  if (missingCount < 0 || (compressedParts.length === 1 && head.length !== 8)) return null;
  const labels = [...head, ...Array(missingCount).fill("0"), ...tail];
  if (labels.length !== 8) return null;
  const hextets = labels.map((label) => {
    if (!/^[0-9a-f]{1,4}$/.test(label)) return null;
    return Number.parseInt(label, 16);
  });
  return hextets.every((value) => Number.isInteger(value) && value >= 0 && value <= 0xffff) ? hextets : null;
}

function ipv6PrefixMatches(hextets, prefix, prefixLength) {
  let remainingBits = prefixLength;
  for (let index = 0; remainingBits > 0; index++) {
    const bits = Math.min(remainingBits, 16);
    const mask = bits === 16 ? 0xffff : (0xffff << (16 - bits)) & 0xffff;
    if ((hextets[index] & mask) !== (prefix[index] & mask)) return false;
    remainingBits -= bits;
  }
  return true;
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

function isReservedOrSpecialIpv6(host) {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  const mappedIpv4Parts = mappedIpv4PartsFromIpv6(normalized);
  if (mappedIpv4Parts) {
    return isReservedOrSpecialIpv4(mappedIpv4Parts.join("."));
  }
  const hextets = ipv6Hextets(normalized);
  if (!hextets) return false;
  const specialPrefixes = [
    [[0x0064, 0xff9b, 0x0001, 0, 0, 0, 0, 0], 48],
    [[0x0100, 0, 0, 0, 0, 0, 0, 0], 64],
    [[0x0100, 0, 0, 1, 0, 0, 0, 0], 64],
    [[0x2001, 0x0002, 0, 0, 0, 0, 0, 0], 48],
    [[0x2001, 0x0010, 0, 0, 0, 0, 0, 0], 28],
    [[0x2001, 0x0db8, 0, 0, 0, 0, 0, 0], 32],
    [[0x2002, 0, 0, 0, 0, 0, 0, 0], 16],
    [[0x3fff, 0, 0, 0, 0, 0, 0, 0], 20],
    [[0x5f00, 0, 0, 0, 0, 0, 0, 0], 16],
    [[0xff00, 0, 0, 0, 0, 0, 0, 0], 8],
  ];
  const reservedGlobalUnicastPrefixes = [
    [[0x2d00, 0, 0, 0, 0, 0, 0, 0], 8],
    [[0x2e00, 0, 0, 0, 0, 0, 0, 0], 7],
    [[0x3000, 0, 0, 0, 0, 0, 0, 0], 5],
    [[0x3800, 0, 0, 0, 0, 0, 0, 0], 6],
    [[0x3c00, 0, 0, 0, 0, 0, 0, 0], 7],
    [[0x3e00, 0, 0, 0, 0, 0, 0, 0], 8],
    [[0x3f00, 0, 0, 0, 0, 0, 0, 0], 9],
    [[0x3f80, 0, 0, 0, 0, 0, 0, 0], 10],
    [[0x3fc0, 0, 0, 0, 0, 0, 0, 0], 11],
    [[0x3fe0, 0, 0, 0, 0, 0, 0, 0], 12],
    [[0x3ff0, 0, 0, 0, 0, 0, 0, 0], 13],
    [[0x3ff8, 0, 0, 0, 0, 0, 0, 0], 14],
    [[0x3ffc, 0, 0, 0, 0, 0, 0, 0], 15],
    [[0x3ffe, 0, 0, 0, 0, 0, 0, 0], 16],
  ];
  return [...specialPrefixes, ...reservedGlobalUnicastPrefixes].some(
    ([prefix, prefixLength]) => ipv6PrefixMatches(hextets, prefix, prefixLength)
  );
}

function isReservedOrSpecialIpLiteralHost(host) {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (ipv4Parts(host)) return isReservedOrSpecialIpv4(host);
  if (!normalized.includes(":")) return false;
  return isReservedOrSpecialIpv6(normalized);
}

function isIpLiteralHost(host) {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  return Boolean(ipv4Parts(host)) || normalized.includes(":");
}

function isSingleLabelHostname(host) {
  return !isIpLiteralHost(host) && !host.includes(".");
}

function isDnsCompatibleHostname(host) {
  if (isIpLiteralHost(host)) return true;
  if (host.length > 253) return false;
  const labels = host.split(".");
  return labels.every((label) => (
    label.length >= 1 &&
    label.length <= 63 &&
    /^[a-z0-9-]+$/.test(label) &&
    !label.startsWith("-") &&
    !label.endsWith("-")
  ));
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
  const rawValue = String(rawUrl || "");
  const value = rawValue.trim();
  if (/[\u0000-\u001f\u007f]/.test(rawValue)) {
    throw new Error(`${safeLabel} must not include ASCII control characters`);
  }
  if (value.includes(" ")) {
    throw new Error(`${safeLabel} must not include unencoded spaces`);
  }
  if (value.includes("\\")) {
    throw new Error(`${safeLabel} must not include backslashes`);
  }
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
  if (parsed.port) {
    throw new Error(`${safeLabel} must use the default HTTPS port`);
  }
  const host = parsed.hostname.toLowerCase();
  const rawHost = rawHostFromUrlValue(value);
  if (ipv4Parts(host) && rawHost !== host) {
    throw new Error(`${safeLabel} must use canonical dotted-decimal IPv4 literals`);
  }
  if (isLocalOrPrivateHost(host)) {
    throw new Error(`${safeLabel} must not point to a local or private network target`);
  }
  if (isReservedOrSpecialIpLiteralHost(host)) {
    throw new Error(`${safeLabel} must not point to a reserved or special-use network target`);
  }
  if (isSingleLabelHostname(host)) {
    throw new Error(`${safeLabel} must use a fully qualified public hostname or IP address`);
  }
  if (!isDnsCompatibleHostname(host)) {
    throw new Error(`${safeLabel} must use DNS-compatible public hostname labels`);
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
