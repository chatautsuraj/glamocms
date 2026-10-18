import { test } from "node:test";
import assert from "node:assert/strict";
import { NAV, canAccessPath, hasAny, homeFor } from "../src/lib/auth/permissions";

const CASHIER = ["pos.sell", "pos.till", "orders.read.own"];
const MANAGER = [...CASHIER, "pos.override", "orders.read.all", "orders.write", "customers.write", "catalog.write", "inventory.write", "analytics.read", "reports.read", "delivery.manage", "whatsapp.inbox", "settings.read"];
const SUPER = [...MANAGER, "settings.write", "staff.manage", "whatsapp.broadcast"];

const visible = (perms: string[]) => NAV.filter((n) => hasAny(perms, n.anyOf)).map((n) => n.href);

test("cashier sees only till, own orders, customer lookup (+ dashboard)", () => {
  assert.deepEqual(visible(CASHIER), ["/dashboard", "/till", "/orders", "/customers"]);
  assert.equal(canAccessPath(CASHIER, "/products"), false);
  assert.equal(canAccessPath(CASHIER, "/settings"), false);
  assert.equal(canAccessPath(CASHIER, "/orders/abc"), true);
  assert.equal(homeFor(CASHIER), "/till");
});

test("manager gets commerce; settings read-only; super admin gets everything", () => {
  assert.ok(visible(MANAGER).includes("/products") && visible(MANAGER).includes("/whatsapp") && visible(MANAGER).includes("/settings"));
  assert.equal(homeFor(MANAGER), "/dashboard");
  assert.equal(visible(SUPER).length, NAV.length);
});
