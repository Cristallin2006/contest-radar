import { createHash } from "node:crypto";

const WINDOW_MS = 90_000;
const MAX_VISITORS = 10_000;
const seen = new Map();

function keyOf(visitor) {
  return createHash("sha256").update(`presence:${visitor}`).digest("hex").slice(0, 32);
}

function prune(now) {
  for (const [key, at] of seen) {
    if (now - at > WINDOW_MS) seen.delete(key);
  }
}

export function touchPresence(visitor, now = Date.now()) {
  const key = keyOf(visitor);
  seen.delete(key);
  seen.set(key, now);
  prune(now);
  while (seen.size > MAX_VISITORS) seen.delete(seen.keys().next().value);
  return seen.size;
}

export function onlineCount(now = Date.now()) {
  prune(now);
  return seen.size;
}

export function resetPresence() {
  seen.clear();
}

export const PRESENCE_WINDOW_SECONDS = WINDOW_MS / 1000;
