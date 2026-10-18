import { test } from "node:test";
import assert from "node:assert/strict";
import { counterPhoneError, isNepalMobile, normalizeNepalMobile, validateOrderCustomer } from "../src/lib/pos/customer";

test("Nepali mobiles: 98/97 + 8 digits, with or without +977 / spaces / dashes", () => {
  assert.equal(isNepalMobile("9812345678"), true);
  assert.equal(isNepalMobile("9741234567"), true);
  assert.equal(isNepalMobile("+977 981-234-5678"), true);
  assert.equal(normalizeNepalMobile("+977-9812345678"), "9812345678");
  assert.equal(isNepalMobile("9612345678"), false, "96 is not a mobile prefix");
  assert.equal(isNepalMobile("981234567"), false, "9 digits");
  assert.equal(isNepalMobile("01-5550000"), false, "landline");
});

test("phone / WhatsApp orders need name, valid mobile and address", () => {
  assert.deepEqual(validateOrderCustomer({ name: "Sita Shrestha", phone: "9812345678", address: "Thimi-5, Bhaktapur" }), {});
  const empty = validateOrderCustomer({ name: " ", phone: "", address: "" });
  assert.deepEqual(Object.keys(empty).sort(), ["address", "name", "phone"]);
  assert.match(validateOrderCustomer({ name: "Sita", phone: "12345", address: "Thimi" }).phone ?? "", /98 or 97/);
  assert.ok(validateOrderCustomer({ name: "Sita", phone: "9812345678", address: "ab" }).address);
  assert.deepEqual(validateOrderCustomer({ name: "Sita", phone: "9812345678", address: "" }, { requireAddress: false }), {}, "pickup orders skip the address");
});

test("counter sale: phone is optional but must be valid when typed", () => {
  assert.equal(counterPhoneError(""), null);
  assert.equal(counterPhoneError("9812345678"), null);
  assert.ok(counterPhoneError("98123"));
});
