import "./storage";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { expiryState, saleBlockReason } from "../src/lib/cosmetics";
import { useAppStore, resolveUnitPrice, type Product } from "../src/lib/store";
import { PRODUCTS } from "../src/lib/mock-data";
import { migrateGlamoCatalog } from "../src/lib/catalog-migration";
import legacy from "../src/lib/legacy-cosmetics-catalog.json";
import catalog from "../src/lib/glamo-catalog.json";
import { existsSync } from "node:fs";

const initial = useAppStore.getState();
beforeEach(() => {
  useAppStore.setState({ ...initial, activeTenantId: "t1", currentUserId: "u1" });
});
const state = () => useAppStore.getState();
test("source prices and all 70 local photos match the imported catalog",()=>{
  for(const source of catalog){
    const p=PRODUCTS.find(p=>p.id===`t1-${source.sourceId}`)!;
    assert.equal(p.tradePrice,source.price);
    assert.equal(p.sourceStockSnapshot,source.stock);
    assert.ok(existsSync(`public${p.image}`));
  }
});
test("catalog upgrade preserves edited, custom and transaction-linked products and is idempotent",()=>{
  const edited={...legacy[0],name:"My edited product"};
  const custom={...legacy[0],id:"custom",sku:"CUSTOM"};
  const input={products:[edited,legacy[1],legacy[2],custom] as Product[],invoices:[{items:[{productId:legacy[1].id}]}]};
  const result=migrateGlamoCatalog(input);
  assert.equal(result.products.find(p=>p.id===edited.id)?.name,edited.name);
  assert.ok(result.products.some(p=>p.id===legacy[1].id));
  assert.ok(!result.products.some(p=>p.id===legacy[2].id));
  assert.ok(result.products.some(p=>p.id==="custom"));
  assert.equal(result.products.length,143);
  assert.deepEqual(migrateGlamoCatalog(result),result);
});
function sale(product: Product, qty = 1, extra = {}) {
  return state().addInvoice({
    customer: "Aarati Shrestha", customerId: "c1", status: "PAID", method: "CASH",
    subtotal: product.tradePrice * qty, vat: Math.round(product.tradePrice * qty * 0.13),
    total: product.tradePrice * qty + Math.round(product.tradePrice * qty * 0.13), due: 0,
    items: [{ productId: product.id, sku: product.sku, name: product.name, qty,
      unitPrice: product.tradePrice, discountPercent: 0, lineTotal: product.tradePrice * qty }], ...extra,
  });
}

test("expiry uses local dates with inclusive expiry day and a 90-day warning", () => {
  const now = new Date(2026, 8, 17, 18);
  assert.equal(expiryState("2026-09-16", now), "expired");
  assert.equal(expiryState("2026-09-17", now), "soon");
  assert.equal(expiryState("2026-12-16", now), "soon");
  assert.equal(expiryState("2026-12-17", now), "ok");
  assert.equal(expiryState(undefined, now), "none");
});
test("tester products are not sellable", () => {
  assert.match(saleBlockReason({name: "Tester", isTester: true})!, /tester/);
});
test("catalog contains 70 real products per store with photos and no invented batch dates", () => {
  assert.equal(PRODUCTS.length, 140);
  assert.equal(new Set(PRODUCTS.map(p => p.tenantId + p.sku)).size, PRODUCTS.length);
  assert.ok(PRODUCTS.every(p => p.image && p.sourceUrl));
  assert.ok(PRODUCTS.every(p => !p.batchNumber && !p.expiresOn));
  assert.ok(PRODUCTS.every(p => p.tradePrice > 0 && p.tradePrice <= p.mrp));
});
test("new product retains shade, batch, expiry, opening period and tester flag", () => {
  const p = state().addProduct({...PRODUCTS[0], sku: "test-rose", shade: "Coral", batchNumber: "B-TEST", expiresOn: "2030-12-31", paoMonths: "6", isTester: true});
  assert.equal(p.sku, "TEST-ROSE");
  assert.equal(p.shade, "Coral");
  assert.equal(p.batchNumber, "B-TEST");
  assert.equal(p.expiresOn, "2030-12-31");
  assert.equal(p.paoMonths, "6");
  assert.equal(p.isTester, true);
  assert.equal(state().products.find(x => x.id === p.id)?.batchNumber, "B-TEST");
});
test("editing a product preserves and updates cosmetics metadata", () => {
  const p = state().updateProduct(PRODUCTS[0].id, {shade: "Coral", expiresOn: "2030-01-31", isTester: true});
  assert.equal(p?.shade, "Coral");
  assert.equal(p?.expiresOn, "2030-01-31");
  assert.equal(p?.isTester, true);
});
test("cosmetic attributes survive persistence and rehydration", async () => {
  state().updateProduct(PRODUCTS[0].id, {shade:"Persisted Coral",batchNumber:"RELOAD-26",isTester:true});
  await useAppStore.persist.rehydrate();
  const p=state().products.find(p=>p.id===PRODUCTS[0].id)!;
  assert.equal(p.shade,"Persisted Coral");
  assert.equal(p.batchNumber,"RELOAD-26");
  assert.equal(p.isTester,true);
});
test("duplicate SKUs are rejected in the same store", () => {
  assert.throws(() => state().addProduct({...PRODUCTS[0], sku: PRODUCTS[0].sku.toLowerCase()}), /already exists/);
});
test("cash checkout creates an invoice, decrements stock and updates customer history", () => {
  const p = state().products[0], c = state().customers.find(x => x.id === "c1")!;
  const invoice = sale(p, 2);
  assert.equal(state().products.find(x => x.id === p.id)?.stock, p.stock - 2);
  assert.equal(state().invoices[0].id, invoice.id);
  const after = state().customers.find(x => x.id === "c1")!;
  assert.equal(after.orders, c.orders + 1);
  assert.equal(after.lifetime, c.lifetime + invoice.total);
  assert.equal(after.outstanding, c.outstanding);
});
test("overselling leaves invoices and stock untouched", () => {
  const p = state().products[0], invoices = state().invoices.length;
  assert.throws(() => sale(p, p.stock + 1), /Insufficient stock/);
  assert.equal(state().invoices.length, invoices);
  assert.equal(state().products[0].stock, p.stock);
});
test("duplicate cart rows cannot bypass stock validation", () => {
  const p = state().products[0];
  const line = {productId:p.id,sku:p.sku,name:p.name,qty:p.stock,unitPrice:p.tradePrice,discountPercent:0,lineTotal:p.tradePrice*p.stock};
  assert.throws(() => sale(p, 1, {items:[line,line]}), /Insufficient stock/);
});
test("expired products and testers are blocked at invoice creation", () => {
  state().updateProduct(PRODUCTS[0].id, {expiresOn:"2000-01-01"});
  assert.throws(() => sale(state().products[0]), /expired/);
  state().updateProduct(PRODUCTS[0].id, {expiresOn:"2030-01-01",isTester:true});
  assert.throws(() => sale(state().products[0]), /tester/);
});
test("cross-store products cannot be invoiced", () => {
  assert.throws(() => sale(state().products.find(p=>p.tenantId==="t2")!), /not available/);
});
test("zero, negative, fractional and NaN quantities are rejected", () => {
  for(const qty of [0,-1,1.5,NaN]) assert.throws(() => sale(state().products[0],qty), /positive whole numbers/);
});
test("customer price-list rates use cosmetic price levels", () => {
  const price=resolveUnitPrice({productId:PRODUCTS[0].id,customerId:"c1",date:"2026-09-17"});
  assert.equal(price, PRODUCTS[0].tradePrice);
});
test("credit invoice and payment maintain the customer balance", () => {
  const c=state().customers.find(c=>c.id==="c1")!;
  const p=state().products[0], total=p.tradePrice+Math.round(p.tradePrice*0.13);
  const invoice=sale(p,1,{status:"ISSUED",method:"CREDIT",due:total});
  assert.equal(state().customers.find(x=>x.id==="c1")?.outstanding,c.outstanding+total);
  state().recordPayment(invoice.id,total,"CASH");
  assert.equal(state().invoices.find(x=>x.id===invoice.id)?.due,0);
  assert.equal(state().customers.find(x=>x.id==="c1")?.outstanding,c.outstanding);
});
