import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseSseChunk, createMessage } = require("../../lib/anthropic-client.js");

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === "function") throw new Error("use asyncTest for async");
    pass += 1;
    console.log(`PASS  ${name}`);
  } catch (err) {
    fail += 1;
    console.log(`FAIL  ${name}: ${err.message}`);
  }
}

const asyncTests = [];
function asyncTest(name, fn) { asyncTests.push([name, fn]); }

test("parseSseChunk extracts complete events and keeps the remainder", () => {
  const buf = 'event: a\ndata: {"x":1}\n\nevent: b\ndata: {"y":2}\n\ndata: partial';
  const { events, rest } = parseSseChunk(buf);
  assert.equal(events.length, 2);
  assert.deepEqual(events[0], { x: 1 });
  assert.deepEqual(events[1], { y: 2 });
  assert.equal(rest, "data: partial");
});

test("parseSseChunk returns no events when nothing is complete", () => {
  const { events, rest } = parseSseChunk('data: {"x"');
  assert.equal(events.length, 0);
  assert.equal(rest, 'data: {"x"');
});

test("parseSseChunk skips unparsable data lines", () => {
  const { events } = parseSseChunk("data: not-json\n\n");
  assert.equal(events.length, 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
