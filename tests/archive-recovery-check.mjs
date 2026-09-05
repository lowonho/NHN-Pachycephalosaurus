import assert from "node:assert/strict";
import { createProgressStore, PROGRESS_KEY } from "../js/archive/progress.mjs";
import { MEMORY_FRAGMENTS, touchesFragment } from "../js/archive/fragments.mjs";
import { STAGES } from "../js/archive/data.mjs";
import { WALLS, ROUTE, START } from "../js/archive/level-data.mjs";

const ids = STAGES.map((stage) => stage.id);
const memory = new Map();
const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
let store = createProgressStore(ids, storage);
assert.equal(store.summary().recoveryRate, 0);
assert.equal(store.record("maze", false, true).result, "RECORD LOST");
assert.equal(store.summary().fragmentCount, 0);
assert.equal(store.status("maze"), "DAMAGED");
assert.equal(store.record("maze", true, false).result, "PARTIALLY RESTORED");
assert.equal(store.summary().recoveryRate, 10);
assert.equal(store.record("maze", true, true).fragmentCount, 1);
store.record("maze", true, true);
store.record("maze", false, false);
assert.equal(store.record("maze", true, false).result, "PARTIALLY RESTORED");
assert.equal(store.status("maze"), "FULLY RESTORED");
store = createProgressStore(ids, storage);
assert.equal(store.summary().fragmentCount, 1);
for (const id of ids) store.record(id, true, false);
assert.equal(store.summary().ending, "incomplete");
for (const id of ids.slice(0, 4)) store.record(id, true, true);
assert.equal(store.summary().ending, "normal");
for (const id of ids) store.record(id, true, true);
assert.equal(store.summary().recoveryRate, 100);
assert.equal(store.summary().ending, "complete");
assert.equal(store.summary().fragmentCount, 5);
for (const saved of ["invalid", "null", '{"version":1,"records":{"maze":"FULLY RESTORED","gravity":"fake","unknown":"FULLY RESTORED"}}']) {
  memory.set(PROGRESS_KEY, saved);
  const recovered = createProgressStore(ids, storage);
  assert.equal(recovered.status("gravity"), "DAMAGED");
  assert.ok(recovered.summary().fragmentCount <= 1);
}
const blocked = createProgressStore(ids, { getItem() { throw Error(); }, setItem() { throw Error(); } });
assert.equal(blocked.record("maze", true, true).fragmentCount, 1);
assert.throws(() => store.record("unknown", true, true));
for (const id of ids) assert.ok(MEMORY_FRAGMENTS[id]);
assert.ok(touchesFragment({ x: 100, y: 100, radius: 12 }, { x: 140, y: 100, radius: 5 }, { x: 60, y: 100 }));
assert.ok(!touchesFragment({ x: 100, y: 100, radius: 12 }, { x: 140, y: 130, radius: 5 }, { x: 60, y: 130 }));
const fragment = MEMORY_FRAGMENTS.maze;
assert.ok(WALLS.every((wall) => !touchesFragment(fragment, {
  x: Math.max(wall.x, Math.min(fragment.x, wall.x + wall.w)),
  y: Math.max(wall.y, Math.min(fragment.y, wall.y + wall.h)), radius: 0,
})));
for (let i = 0; i < ROUTE.length; i++) assert.ok(!touchesFragment(fragment, ROUTE[i], i ? ROUTE[i - 1] : START));
console.log("PASS | result transitions, no downgrade/duplicates, reload, damaged/unavailable storage, ending thresholds, swept pickup, off-route maze placement");
