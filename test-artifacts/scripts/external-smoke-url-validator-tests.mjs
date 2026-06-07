// External smoke URL preflight validator tests.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const validatorPath = fileURLToPath(new URL("../../scripts/validate-external-smoke-url.mjs", import.meta.url));

let pass = 0;
let fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

function checkThrows(label, fn, expectedMessage) {
  try {
    fn();
    console.log(`FAIL  ${label}`);
    console.log(`  expected throw ${JSON.stringify(expectedMessage)}`);
    fail++;
  } catch (error) {
    const ok = String(error.message) === expectedMessage;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
    if (!ok) console.log(`  expected ${JSON.stringify(expectedMessage)}\n  got      ${JSON.stringify(error.message)}`);
    ok ? pass++ : fail++;
  }
}

check("external smoke URL validator script exists",
  fs.existsSync(validatorPath),
  true);

if (fs.existsSync(validatorPath)) {
  const { validateExternalSmokeUrl } = await import(validatorPath);

  check("validateExternalSmokeUrl accepts external https URL",
    validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com"),
    "https://demo.example.com/");

  check("validateExternalSmokeUrl accepts explicit root slash URL",
    validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/"),
    "https://demo.example.com/");

  check("validateExternalSmokeUrl trims URL input",
    validateExternalSmokeUrl("external_readonly_url", "  https://demo.example.com  "),
    "https://demo.example.com/");

  checkThrows("validateExternalSmokeUrl rejects missing scheme authority separator",
    () => validateExternalSmokeUrl("external_readonly_url", "https:demo.example.com"),
    "external_readonly_url must begin with https://");

  checkThrows("validateExternalSmokeUrl rejects single slash scheme authority separator",
    () => validateExternalSmokeUrl("external_readonly_url", "https:/demo.example.com"),
    "external_readonly_url must begin with https://");

  checkThrows("validateExternalSmokeUrl rejects uppercase scheme spelling",
    () => validateExternalSmokeUrl("external_readonly_url", "HTTPS://demo.example.com"),
    "external_readonly_url must begin with https://");

  checkThrows("validateExternalSmokeUrl rejects non-root path",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/app"),
    "external_readonly_url must point to the demo origin root path");

  checkThrows("validateExternalSmokeUrl rejects unencoded path space",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/pa th"),
    "external_readonly_url must not include unencoded spaces");

  checkThrows("validateExternalSmokeUrl rejects unencoded nested path space",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/a b/c"),
    "external_readonly_url must not include unencoded spaces");

  checkThrows("validateExternalSmokeUrl rejects parent path segment",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/a/../admin"),
    "external_readonly_url must not include path dot segments");

  checkThrows("validateExternalSmokeUrl rejects current path segment",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/a/./admin"),
    "external_readonly_url must not include path dot segments");

  checkThrows("validateExternalSmokeUrl rejects encoded parent path segment",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/%2e%2e/admin"),
    "external_readonly_url must not include path dot segments");

  checkThrows("validateExternalSmokeUrl rejects mixed encoded parent path segment",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/.%2e/admin"),
    "external_readonly_url must not include path dot segments");

  checkThrows("validateExternalSmokeUrl rejects non-root ellipsis path segment",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/.../admin"),
    "external_readonly_url must point to the demo origin root path");

  checkThrows("validateExternalSmokeUrl rejects embedded newline",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/pa\nth"),
    "external_readonly_url must not include ASCII control characters");

  checkThrows("validateExternalSmokeUrl rejects embedded tab",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/pa\tth"),
    "external_readonly_url must not include ASCII control characters");

  checkThrows("validateExternalSmokeUrl rejects backslash in URL path",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com\\path"),
    "external_readonly_url must not include backslashes");

  checkThrows("validateExternalSmokeUrl rejects backslash after scheme",
    () => validateExternalSmokeUrl("external_readonly_url", "https:\\\\demo.example.com\\path"),
    "external_readonly_url must not include backslashes");

  check("validateExternalSmokeUrl accepts explicit default HTTPS port",
    validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com:443/"),
    "https://demo.example.com/");

  checkThrows("validateExternalSmokeUrl rejects explicit non-default HTTPS port",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com:4443/path"),
    "external_readonly_url must use the default HTTPS port");

  checkThrows("validateExternalSmokeUrl rejects http URL",
    () => validateExternalSmokeUrl("external_readonly_url", "http://demo.example.com"),
    "external_readonly_url needs an https:// URL");

  checkThrows("validateExternalSmokeUrl rejects invalid URL",
    () => validateExternalSmokeUrl("external_readonly_url", "not-a-url"),
    "external_readonly_url needs an https:// URL");

  checkThrows("validateExternalSmokeUrl rejects URL credentials",
    () => validateExternalSmokeUrl("external_readonly_url", "https://user:pass@demo.example.com"),
    "external_readonly_url must not include username/password, query string, or fragment");

  checkThrows("validateExternalSmokeUrl rejects query string",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com?token=secret"),
    "external_readonly_url must not include username/password, query string, or fragment");

  checkThrows("validateExternalSmokeUrl rejects fragment",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com#secret"),
    "external_readonly_url must not include username/password, query string, or fragment");

  checkThrows("validateExternalSmokeUrl rejects localhost",
    () => validateExternalSmokeUrl("external_readonly_url", "https://localhost"),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("validateExternalSmokeUrl rejects loopback IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://127.0.0.1"),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("validateExternalSmokeUrl rejects loopback IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[::1]"),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("validateExternalSmokeUrl rejects .localhost names",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.localhost"),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("validateExternalSmokeUrl rejects single-label hostname",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo/path"),
    "external_readonly_url must use a fully qualified public hostname or IP address");

  checkThrows("validateExternalSmokeUrl rejects Unicode hostname label",
    () => validateExternalSmokeUrl("external_readonly_url", "https://bücher.example"),
    "external_readonly_url must use DNS-compatible public hostname labels");

  checkThrows("validateExternalSmokeUrl rejects Unicode TLD label",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.例子"),
    "external_readonly_url must use DNS-compatible public hostname labels");

  checkThrows("validateExternalSmokeUrl rejects percent-encoded hostname label",
    () => validateExternalSmokeUrl("external_readonly_url", "https://%65xample.com"),
    "external_readonly_url must use DNS-compatible public hostname labels");

  checkThrows("validateExternalSmokeUrl rejects fullwidth hostname label",
    () => validateExternalSmokeUrl("external_readonly_url", "https://ｅxample.com"),
    "external_readonly_url must use DNS-compatible public hostname labels");

  checkThrows("validateExternalSmokeUrl rejects hostname label underscore",
    () => validateExternalSmokeUrl("external_readonly_url", "https://bad_host.example.com/path"),
    "external_readonly_url must use DNS-compatible public hostname labels");

  checkThrows("validateExternalSmokeUrl rejects hostname label leading hyphen",
    () => validateExternalSmokeUrl("external_readonly_url", "https://-demo.example.com/path"),
    "external_readonly_url must use DNS-compatible public hostname labels");

  checkThrows("validateExternalSmokeUrl rejects hostname label trailing hyphen",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo-.example.com/path"),
    "external_readonly_url must use DNS-compatible public hostname labels");

  checkThrows("validateExternalSmokeUrl rejects empty hostname label",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo..example.com/path"),
    "external_readonly_url must use DNS-compatible public hostname labels");

  checkThrows("validateExternalSmokeUrl rejects trailing root dot",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com./path"),
    "external_readonly_url must use DNS-compatible public hostname labels");

  check("validateExternalSmokeUrl accepts hyphenated hostname labels",
    validateExternalSmokeUrl("external_readonly_url", "https://demo-edge.example.com"),
    "https://demo-edge.example.com/");

  check("validateExternalSmokeUrl accepts punycoded hostname labels",
    validateExternalSmokeUrl("external_readonly_url", "https://xn--bcher-kva.example"),
    "https://xn--bcher-kva.example/");

  check("validateExternalSmokeUrl accepts public IPv4 literal",
    validateExternalSmokeUrl("external_readonly_url", "https://8.8.8.8"),
    "https://8.8.8.8/");

  checkThrows("validateExternalSmokeUrl rejects integer IPv4 literal",
    () => validateExternalSmokeUrl("external_readonly_url", "https://134744072/path"),
    "external_readonly_url must use canonical dotted-decimal IPv4 literals");

  checkThrows("validateExternalSmokeUrl rejects shortened IPv4 literal",
    () => validateExternalSmokeUrl("external_readonly_url", "https://8.8.2056/path"),
    "external_readonly_url must use canonical dotted-decimal IPv4 literals");

  check("validateExternalSmokeUrl accepts public IPv6 literal",
    validateExternalSmokeUrl("external_readonly_url", "https://[2001:4860:4860::8888]"),
    "https://[2001:4860:4860::8888]/");

  checkThrows("validateExternalSmokeUrl rejects private IPv4 10/8",
    () => validateExternalSmokeUrl("external_readonly_url", "https://10.0.0.5"),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("validateExternalSmokeUrl rejects private IPv4 172.16/12 lower bound",
    () => validateExternalSmokeUrl("external_readonly_url", "https://172.16.0.1"),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("validateExternalSmokeUrl rejects private IPv4 172.16/12 upper bound",
    () => validateExternalSmokeUrl("external_readonly_url", "https://172.31.255.255"),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("validateExternalSmokeUrl rejects private IPv4 192.168/16",
    () => validateExternalSmokeUrl("external_readonly_url", "https://192.168.1.10"),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("validateExternalSmokeUrl rejects link-local IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://169.254.1.1"),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("validateExternalSmokeUrl rejects carrier-grade NAT IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://100.64.0.1"),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("validateExternalSmokeUrl rejects documentation IPv4 TEST-NET-1",
    () => validateExternalSmokeUrl("external_readonly_url", "https://192.0.2.10"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects documentation IPv4 TEST-NET-2",
    () => validateExternalSmokeUrl("external_readonly_url", "https://198.51.100.10"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects documentation IPv4 TEST-NET-3",
    () => validateExternalSmokeUrl("external_readonly_url", "https://203.0.113.10"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects benchmarking IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://198.18.0.1"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects multicast IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://224.0.0.1"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects reserved IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://240.0.0.1"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects limited broadcast IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://255.255.255.255"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects IETF protocol assignment IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://192.0.0.8"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects PCP anycast IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://192.0.0.9"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects NAT64 discovery IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://192.0.0.170"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects AS112 IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://192.31.196.1"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects AMT IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://192.52.193.1"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects deprecated 6to4 relay IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://192.88.99.2"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects direct delegation AS112 IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://192.175.48.1"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects unspecified IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://0.0.0.0"),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("validateExternalSmokeUrl rejects unique-local IPv6 fc00",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[fc00::1]"),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("validateExternalSmokeUrl rejects unique-local IPv6 fd00",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[fd12::1]"),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("validateExternalSmokeUrl rejects link-local IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[fe80::1]"),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("validateExternalSmokeUrl rejects documentation IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[2001:db8::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects benchmarking IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[2001:2::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects multicast IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[ff02::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects discard-only IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[100::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects dummy IPv6 prefix",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[100:0:0:1::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects local-use translation IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[64:ff9b:1::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects deprecated ORCHID IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[2001:10::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects 6to4 IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[2002::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects SRv6 SID IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[5f00::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects 6bone returned IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[3ffe::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects new documentation IPv6 block",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[3fff::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects IANA reserved IPv6 global-unicast block",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[3000::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects IPv4-mapped loopback IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[::ffff:127.0.0.1]"),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("validateExternalSmokeUrl rejects IPv4-mapped private IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[::ffff:192.168.1.1]"),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("validateExternalSmokeUrl rejects IPv4-mapped carrier-grade NAT IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[::ffff:100.64.0.1]"),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("validateExternalSmokeUrl rejects IPv4-mapped documentation IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[::ffff:203.0.113.10]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  check("validateExternalSmokeUrl accepts IPv4-mapped public IPv6",
    validateExternalSmokeUrl("external_readonly_url", "https://[::ffff:8.8.8.8]"),
    "https://[::ffff:808:808]/");

  const badCli = spawnSync(process.execPath, [
    validatorPath,
    "external_readonly_url",
    "https://demo.example.com/?token=secret",
  ], { encoding: "utf8" });

  check("CLI exits non-zero for URL with query string",
    badCli.status,
    1);

  check("CLI prints concise URL preflight failure",
    badCli.stderr.trim(),
    "FAIL external_readonly_url must not include username/password, query string, or fragment");

  const goodCli = spawnSync(process.execPath, [
    validatorPath,
    "external_readonly_url",
    "https://demo.example.com",
  ], { encoding: "utf8" });

  check("CLI exits zero for valid URL",
    goodCli.status,
    0);

  check("CLI prints normalized valid URL",
    goodCli.stdout.trim(),
    "OK external_readonly_url https://demo.example.com/");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
