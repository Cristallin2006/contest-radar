import test from "node:test";
import assert from "node:assert/strict";
import { onlineCount, resetPresence, touchPresence } from "../presence.js";

test("presence counts distinct visitors in the active window", () => {
  resetPresence();
  const now = 1_000_000;
  assert.equal(touchPresence("visitor-a", now), 1);
  assert.equal(touchPresence("visitor-b", now + 1000), 2);
  assert.equal(touchPresence("visitor-a", now + 2000), 2);
  assert.equal(onlineCount(now + 3000), 2);
});

test("presence drops visitors after the heartbeat window", () => {
  resetPresence();
  const now = 2_000_000;
  touchPresence("visitor-a", now);
  assert.equal(onlineCount(now + 89_000), 1);
  assert.equal(onlineCount(now + 91_000), 0);
});

test("presence does not retain raw visitor identifiers", () => {
  resetPresence();
  touchPresence("raw-visitor-id", 3_000_000);
  assert.equal(onlineCount(3_000_001), 1);
});
