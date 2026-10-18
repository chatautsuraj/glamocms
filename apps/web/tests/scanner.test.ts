import { test } from "node:test";
import assert from "node:assert/strict";
import { ScanBurstDetector, isTypingTarget, stripScannedSuffix } from "../src/lib/pos/scanner";

/** Feed a string with a fixed gap between keys, then Enter after `enterGap`. */
function type(d: ScanBurstDetector, text: string, start: number, gap: number, enterGap = gap) {
  let t = start;
  for (const ch of text) d.push(ch, (t += gap));
  return { result: d.push("Enter", t + enterGap), end: t + enterGap };
}

test("a USB scanner burst (EAN-13 at ~8ms per key) ending in Enter is a scan", () => {
  const d = new ScanBurstDetector();
  assert.deepEqual(type(d, "2000000000015", 1000, 8).result, { kind: "scan", code: "2000000000015" });
});

test("SKU codes with dashes / letters scan too", () => {
  const d = new ScanBurstDetector();
  assert.deepEqual(type(d, "GLM-MAY-000042", 0, 12).result, { kind: "scan", code: "GLM-MAY-000042" });
});

test("normal typing (120ms per key) followed by Enter is not a scan", () => {
  const d = new ScanBurstDetector();
  assert.deepEqual(type(d, "lipstick", 0, 120).result, { kind: "none" });
});

test("a fast typist's short word is not a scan (min length + average gap)", () => {
  const d = new ScanBurstDetector();
  assert.deepEqual(type(d, "abc", 0, 20).result, { kind: "none" }, "too short");
  assert.deepEqual(type(d, "kajal", 1000, 45).result, { kind: "none" }, "average gap above scanner speed");
});

test("one slow gap inside the burst breaks it", () => {
  const d = new ScanBurstDetector();
  let t = 0;
  for (const ch of "200000") d.push(ch, (t += 8));
  t += 200; // pause
  for (const ch of "0000015") d.push(ch, (t += 8));
  assert.deepEqual(d.push("Enter", t + 8), { kind: "scan", code: "0000015" }, "only the fast part after the pause counts");
});

test("text typed slowly before a scan is not glued to the code", () => {
  const d = new ScanBurstDetector();
  let t = 0;
  for (const ch of "mas") d.push(ch, (t += 180));
  t += 400;
  const r = type(d, "8901030865275", t, 6);
  assert.deepEqual(r.result, { kind: "scan", code: "8901030865275" });
});

test("Enter long after the burst is not a scan; modifier keys don't break a burst", () => {
  const d = new ScanBurstDetector();
  assert.deepEqual(type(d, "8901030865275", 0, 6, 500).result, { kind: "none" });
  let t = 0;
  for (const ch of "ABC") { d.push("Shift", (t += 2)); d.push(ch, (t += 6)); }
  for (const ch of "123") d.push(ch, (t += 6));
  assert.deepEqual(d.push("Enter", t + 6), { kind: "scan", code: "ABC123" });
});

test("isBursting holds back single-key shortcuts while a scan is arriving", () => {
  const d = new ScanBurstDetector();
  d.push("G", 0);
  assert.equal(d.isBursting(5), false, "one key is not yet a burst");
  d.push("L", 8);
  assert.equal(d.isBursting(10), true);
  assert.equal(d.isBursting(200), false);
});

test("scanned characters are removed from the focused input", () => {
  assert.equal(stripScannedSuffix("mas2000000000015", "2000000000015"), "mas");
  assert.equal(stripScannedSuffix("2000000000015", "2000000000015"), "");
  assert.equal(stripScannedSuffix("something else", "2000000000015"), "something else");
});

test("typing targets are recognised", () => {
  assert.equal(isTypingTarget({ tagName: "INPUT", type: "text" } as unknown as EventTarget), true);
  assert.equal(isTypingTarget({ tagName: "INPUT", type: "checkbox" } as unknown as EventTarget), false);
  assert.equal(isTypingTarget({ tagName: "BUTTON" } as unknown as EventTarget), false);
  assert.equal(isTypingTarget({ tagName: "TEXTAREA" } as unknown as EventTarget), true);
  assert.equal(isTypingTarget(null), false);
});
