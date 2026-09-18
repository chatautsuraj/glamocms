/* eslint-disable @typescript-eslint/no-require-imports -- Standalone legacy CommonJS seed maintenance script. */
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "mock-data.ts");
let s = fs.readFileSync(file, "utf8");

function stampArray(name, tenant) {
  const re = new RegExp("(export const " + name + " = \\[[\\s\\S]*?\\];)");
  const m = s.match(re);
  if (!m) {
    console.log("miss", name);
    return;
  }
  let block = m[1];
  // Avoid double-stamping
  if (block.includes("tenantId:")) {
    console.log("skip (already)", name);
    return;
  }
  block = block.replace(/(\s+)(\},)/g, (match, ws, close) => {
    return ws + 'tenantId: "' + tenant + '",' + ws + close;
  });
  block = block.replace(/(\s+)(\}\s*\])/g, (match, ws) => {
    return ws + 'tenantId: "' + tenant + '",' + ws + "}\n];";
  });
  s = s.replace(re, () => block);
  console.log("stamped", name);
}

[
  "CUSTOMERS",
  "PRODUCTS",
  "INVOICES",
  "ORDERS",
  "PURCHASE_ORDERS",
  "SUPPLIERS",
  "EXPENSES",
  "NOTIFICATIONS",
  "DELIVERIES",
  "SALES_TEAM",
  "WAREHOUSES",
  "TOP_CUSTOMERS",
  "TOP_PRODUCTS",
].forEach((n) => stampArray(n, "t1"));

fs.writeFileSync(file, s);
console.log("done");
