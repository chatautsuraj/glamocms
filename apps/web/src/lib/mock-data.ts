import { GLAMO_PRODUCTS } from "./catalog";
export const COMPANY = {
  name: "Glamo Nepal",
  shortName: "Glamo Nepal",
  pan: "601234567",
  vat: "601234567",
  address: "S.S Chowk, Madhyapur Thimi, Bagmati Province 44800",
  phone: "981-8212188",
  email: "hello@glamonepal.com",
  category: "Cosmetics store",
};

export const CURRENT_USER = {
  id: "u1",
  name: "Glamo Manager",
  email: "manager@glamonepal.com",
  role: "OWNER",
  avatar: "GN",
  tenantId: "t1" as string | null,
};

export const DASHBOARD_KPIS = {
  todaySales: 487650,
  todaySalesChange: 12.4,
  monthlySales: 12845600,
  monthlySalesChange: 8.2,
  todayProfit: 89420,
  todayProfitChange: 5.1,
  cashAvailable: 342180,
  outstandingCredit: 2456780,
  bankBalance: 4856200,
  lowStockCount: 7,
  pendingDeliveries: 14,
  pendingOrders: 9,
  inventoryValue: 18754200,
  profitMargin: 18.4,
  businessHealthScore: 82,
};

export const SALES_TREND = [
  { date: "Jul 28", sales: 412000, collection: 380000 },
  { date: "Jul 29", sales: 458000, collection: 420000 },
  { date: "Jul 30", sales: 391000, collection: 405000 },
  { date: "Jul 31", sales: 520000, collection: 480000 },
  { date: "Aug 1", sales: 445000, collection: 410000 },
  { date: "Aug 2", sales: 498000, collection: 460000 },
  { date: "Aug 3", sales: 487650, collection: 392000 },
];

export const CASH_FLOW = [
  { month: "Mar", inflow: 9800000, outflow: 7200000 },
  { month: "Apr", inflow: 10500000, outflow: 7800000 },
  { month: "May", inflow: 11200000, outflow: 8100000 },
  { month: "Jun", inflow: 12100000, outflow: 8600000 },
  { month: "Jul", inflow: 12800000, outflow: 9200000 },
  { month: "Aug", inflow: 4200000, outflow: 3100000 },
];

export const TOP_CUSTOMERS = [
  { id: "c1", name: "Aarati Shrestha", area: "New Road", sales: 1245800, outstanding: 185000, orders: 42, tenantId: "t1" },
  { id: "c2", name: "Patan Beauty Studio", area: "Lalitpur", sales: 985400, outstanding: 420000, orders: 38, tenantId: "t1" },
  { id: "c3", name: "Nisha Karki", area: "Bhaktapur", sales: 742100, outstanding: 0, orders: 31, tenantId: "t1" },
  { id: "c4", name: "Riya Gurung", area: "Thamel", sales: 658900, outstanding: 95000, orders: 28, tenantId: "t1" },
  { id: "c5", name: "Sajha Bridal Studio", area: "Baneshwor", sales: 612300, outstanding: 210000, orders: 25, tenantId: "t1" },
  { id: "c101", name: "Anjali Rai", area: "Lakeside", sales: 185000, outstanding: 22000, orders: 8, tenantId: "t2" },
  { id: "c102", name: "Sushma KC", area: "Chipledhunga", sales: 142000, outstanding: 0, orders: 6, tenantId: "t2" },
];

export const TOP_PRODUCTS = GLAMO_PRODUCTS.filter((p, i) => i % 70 < 5).map((p) => ({id:p.id,name:p.name,brand:p.brand,qty:0,revenue:0,tenantId:p.tenantId}));

export const RECENT_ACTIVITIES = [
  { id: "a1", type: "invoice", text: "Invoice INV-2847 issued to Aarati Shrestha", time: "4 min ago", amount: 45600, tenantId: "t1" },
  { id: "a2", type: "payment", text: "Cash collection Rs 85,000 from Patan Beauty Studio", time: "22 min ago", amount: 85000, tenantId: "t1" },
  { id: "a3", type: "stock", text: "Glamo Nepal catalog imported — review opening stock", time: "1 hr ago", tenantId: "t1" },
  { id: "a4", type: "delivery", text: "Delivery DL-392 completed — Bhaktapur route", time: "2 hr ago", tenantId: "t1" },
  { id: "a5", type: "purchase", text: "Sample purchase receipt — PO-1182", time: "3 hr ago", amount: 320000, tenantId: "t1" },
  { id: "a6", type: "expense", text: "Fuel expense logged — Rs 4,500", time: "4 hr ago", amount: 4500, tenantId: "t1" },
  { id: "a101", type: "invoice", text: "Invoice INV-P042 issued to Anjali Rai", time: "30 min ago", amount: 12500, tenantId: "t2" },
  { id: "a102", type: "payment", text: "QR collection Rs 8,000 from Sushma KC", time: "2 hr ago", amount: 8000, tenantId: "t2" },
];

export const AI_INSIGHTS = [
  { id: "i1", severity: "warning" as const, title: "Collections slowing in Lalitpur", body: "Outstanding from Patan Beauty Studio grew 28% this week. Suggest a collection visit tomorrow.", tenantId: "t1" },
  { id: "i2", severity: "success" as const, title: "70 products ready for your beauty counter", body: "Real product photos, sizes and listed prices are available in the catalog. Review imported stock before your first sale.", tenantId: "t1" },
  { id: "i3", severity: "danger" as const, title: "Batch details need your review", body: "Record batch numbers and expiry dates from received stock. These were not published in the source catalog.", tenantId: "t1" },
  { id: "i101", severity: "success" as const, title: "Lakeside route strong", body: "Weekend tourist demand lifted Anjali Rai orders 22% vs last week.", tenantId: "t2" },
];

export const PRICE_LISTS = [
  { id: "pl-ws-t1", name: "Retail", code: "WS", isDefault: true, tenantId: "t1" },
  { id: "pl-kir-t1", name: "Member", code: "KIR", isDefault: false, tenantId: "t1" },
  { id: "pl-hor-t1", name: "SPA", code: "HOR", isDefault: false, tenantId: "t1" },
  { id: "pl-ws-t2", name: "Retail", code: "WS", isDefault: true, tenantId: "t2" },
  { id: "pl-kir-t2", name: "Member", code: "KIR", isDefault: false, tenantId: "t2" },
];

/** Rates per list. Velvet Matte Lipstick (p1) has overnight change: 18 → 22 on 2026-08-04. */
export const PRICE_LIST_ITEMS = PRICE_LISTS.flatMap((list) => GLAMO_PRODUCTS.filter((p) => p.tenantId === list.tenantId).map((p) => ({id: "glamo-rate-"+list.id+"-"+p.id,priceListId:list.id,productId:p.id,unitPrice:p.tradePrice,effectiveFrom:"2026-09-17",effectiveTo:null})));

export const CUSTOMER_SPECIAL_PRICES: {id:string;tenantId:string;customerId:string;productId:string;unitPrice:number;effectiveFrom:string;effectiveTo:string|null}[] = [];

export const CUSTOMERS = [
  { id: "c1", code: "CUS-001", name: "Aarati Shrestha", type: "INDIVIDUAL", phone: "9841234567", area: "New Road", creditLimit: 300000, outstanding: 185000, riskScore: 32, lastOrder: "2026-08-02", orders: 42, lifetime: 1245800, tenantId: "t1", priceListId: "pl-kir-t1" },
  { id: "c2", code: "CUS-002", name: "Patan Beauty Studio", type: "SALON", phone: "9851112233", area: "Lalitpur", creditLimit: 800000, outstanding: 420000, riskScore: 68, lastOrder: "2026-08-01", orders: 38, lifetime: 985400, tenantId: "t1", priceListId: "pl-ws-t1" },
  { id: "c3", code: "CUS-003", name: "Nisha Karki", type: "INDIVIDUAL", phone: "9812345678", area: "Bhaktapur", creditLimit: 200000, outstanding: 0, riskScore: 12, lastOrder: "2026-08-03", orders: 31, lifetime: 742100, tenantId: "t1", priceListId: "pl-kir-t1" },
  { id: "c4", code: "CUS-004", name: "Riya Gurung", type: "INDIVIDUAL", phone: "9801122334", area: "Thamel", creditLimit: 150000, outstanding: 95000, riskScore: 45, lastOrder: "2026-07-28", orders: 28, lifetime: 658900, tenantId: "t1", priceListId: "pl-kir-t1" },
  { id: "c5", code: "CUS-005", name: "Sajha Bridal Studio", type: "BRIDAL_STUDIO", phone: "9845678901", area: "Baneshwor", creditLimit: 500000, outstanding: 210000, riskScore: 38, lastOrder: "2026-08-02", orders: 25, lifetime: 612300, tenantId: "t1", priceListId: "pl-ws-t1" },
  { id: "c6", code: "CUS-006", name: "Kalimati Salon", type: "SALON", phone: "9867890123", area: "Kalimati", creditLimit: 600000, outstanding: 0, riskScore: 18, lastOrder: "2026-08-03", orders: 22, lifetime: 540200, tenantId: "t1", priceListId: "pl-ws-t1" },
  { id: "c7", code: "CUS-007", name: "Priya Thapa", type: "INDIVIDUAL", phone: "9823456789", area: "Koteshwor", creditLimit: 100000, outstanding: 78000, riskScore: 72, lastOrder: "2026-07-15", orders: 19, lifetime: 298400, tenantId: "t1", priceListId: "pl-kir-t1" },
  { id: "c8", code: "CUS-008", name: "Pulchowk Spa", type: "SPA", phone: "9810987654", area: "Pulchowk", creditLimit: 250000, outstanding: 45000, riskScore: 25, lastOrder: "2026-08-01", orders: 16, lifetime: 312800, tenantId: "t1", priceListId: "pl-hor-t1" },
  { id: "c101", code: "CUS-101", name: "Anjali Rai", type: "INDIVIDUAL", phone: "9847001122", area: "Lakeside", creditLimit: 120000, outstanding: 22000, riskScore: 28, lastOrder: "2026-08-03", orders: 8, lifetime: 185000, tenantId: "t2", priceListId: "pl-kir-t2" },
  { id: "c102", code: "CUS-102", name: "Sushma KC", type: "INDIVIDUAL", phone: "9856012345", area: "Chipledhunga", creditLimit: 100000, outstanding: 0, riskScore: 15, lastOrder: "2026-08-02", orders: 6, lifetime: 142000, tenantId: "t2", priceListId: "pl-kir-t2" },
  { id: "c103", code: "CUS-103", name: "Maya Tamang", type: "INDIVIDUAL", phone: "9816123456", area: "Batulechaur", creditLimit: 80000, outstanding: 15000, riskScore: 40, lastOrder: "2026-07-30", orders: 4, lifetime: 68000, tenantId: "t2", priceListId: "pl-ws-t2" },
];

export const PRODUCTS = GLAMO_PRODUCTS;

export const INVOICES = [
  { id: "inv1", number: "INV-2847", customer: "Aarati Shrestha", date: "2026-08-03", status: "PAID", method: "CASH", subtotal: 40354, vat: 5246, total: 45600, due: 0, tenantId: "t1" },
  { id: "inv2", number: "INV-2846", customer: "Patan Beauty Studio", date: "2026-08-03", status: "PARTIALLY_PAID", method: "CREDIT", subtotal: 110619, vat: 14381, total: 125000, due: 75000, tenantId: "t1" },
  { id: "inv3", number: "INV-2845", customer: "Nisha Karki", date: "2026-08-03", status: "PAID", method: "QR_ESEWA", subtotal: 28319, vat: 3681, total: 32000, due: 0, tenantId: "t1" },
  { id: "inv4", number: "INV-2844", customer: "Sajha Bridal Studio", date: "2026-08-02", status: "ISSUED", method: "CREDIT", subtotal: 77876, vat: 10124, total: 88000, due: 88000, tenantId: "t1" },
  { id: "inv5", number: "INV-2843", customer: "Riya Gurung", date: "2026-08-02", status: "OVERDUE", method: "CREDIT", subtotal: 39823, vat: 5177, total: 45000, due: 45000, tenantId: "t1" },
  { id: "inv6", number: "INV-2842", customer: "Kalimati Salon", date: "2026-08-02", status: "PAID", method: "SPLIT", subtotal: 132743, vat: 17257, total: 150000, due: 0, tenantId: "t1" },
  { id: "inv7", number: "INV-2841", customer: "Pulchowk Spa", date: "2026-08-01", status: "PAID", method: "CASH", subtotal: 22124, vat: 2876, total: 25000, due: 0, tenantId: "t1" },
  { id: "inv8", number: "INV-2840", customer: "Priya Thapa", date: "2026-08-01", status: "PARTIALLY_PAID", method: "CREDIT", subtotal: 53100, vat: 6900, total: 60000, due: 35000, tenantId: "t1" },
  { id: "inv101", number: "INV-P042", customer: "Anjali Rai", date: "2026-08-03", status: "PAID", method: "CASH", subtotal: 11062, vat: 1438, total: 12500, due: 0, tenantId: "t2" },
  { id: "inv102", number: "INV-P041", customer: "Sushma KC", date: "2026-08-02", status: "ISSUED", method: "CREDIT", subtotal: 14159, vat: 1841, total: 16000, due: 16000, tenantId: "t2" },
];

export const ORDERS = [
  { id: "o1", number: "SO-1192", customer: "Aarati Shrestha", date: "2026-08-03", status: "CONFIRMED", items: 12, total: 68500, tenantId: "t1" },
  { id: "o2", number: "SO-1191", customer: "Patan Beauty Studio", date: "2026-08-03", status: "DRAFT", items: 28, total: 142000, tenantId: "t1" },
  { id: "o3", number: "SO-1190", customer: "Nisha Karki", date: "2026-08-02", status: "FULFILLED", items: 8, total: 32000, tenantId: "t1" },
  { id: "o4", number: "SO-1189", customer: "Sajha Bridal Studio", date: "2026-08-02", status: "PARTIALLY_FULFILLED", items: 15, total: 88000, tenantId: "t1" },
  { id: "o5", number: "SO-1188", customer: "Riya Gurung", date: "2026-08-01", status: "INVOICED", items: 6, total: 24500, tenantId: "t1" },
  { id: "o101", number: "SO-P018", customer: "Anjali Rai", date: "2026-08-03", status: "CONFIRMED", items: 5, total: 12500, tenantId: "t2" },
  { id: "o102", number: "SO-P017", customer: "Maya Tamang", date: "2026-08-01", status: "DRAFT", items: 3, total: 4800, tenantId: "t2" },
];

export const INVENTORY = PRODUCTS.map((p) => ({
  ...p,
  warehouse: p.tenantId === "t2" ? "Beauty Store — Lakeside" : "Main Store — Teku",
  batch: `B-${p.sku}-0826`,
  expiry: p.expiresOn,
  value: p.stock * p.tradePrice,
  status: p.stock <= p.reorderAt ? (p.stock < p.reorderAt * 0.3 ? "critical" : "low") : "ok",
}));

export const PURCHASE_ORDERS = [
  { id: "po1", number: "PO-1182", supplier: "Aura Beauty Supply", date: "2026-08-01", status: "RECEIVED", total: 320000, tenantId: "t1" },
  { id: "po2", number: "PO-1183", supplier: "Lumina Cosmetics Supply", date: "2026-08-02", status: "ORDERED", total: 185000, tenantId: "t1" },
  { id: "po3", number: "PO-1184", supplier: "Velvet Beauty Supply", date: "2026-08-03", status: "DRAFT", total: 240000, tenantId: "t1" },
  { id: "po4", number: "PO-1181", supplier: "Botanica Skin Supply", date: "2026-07-28", status: "PARTIALLY_RECEIVED", total: 156000, tenantId: "t1" },
  { id: "po101", number: "PO-P012", supplier: "Aura Beauty Supply", date: "2026-08-02", status: "ORDERED", total: 45000, tenantId: "t2" },
];

export const SUPPLIERS = [
  { id: "s1", name: "Aura Beauty Supply", contact: "Suresh Adhikari", phone: "01-5522334", pan: "301234567", outstanding: 0, products: 12, tenantId: "t1" },
  { id: "s2", name: "Lumina Cosmetics Supply", contact: "Anita KC", phone: "01-4411223", pan: "302345678", outstanding: 185000, products: 8, tenantId: "t1" },
  { id: "s3", name: "Velvet Beauty Supply", contact: "Bikash Thapa", phone: "01-5533445", pan: "303456789", outstanding: 92000, products: 24, tenantId: "t1" },
  { id: "s4", name: "Botanica Skin Supply", contact: "Sunita Rai", phone: "01-4488990", pan: "304567890", outstanding: 45000, products: 15, tenantId: "t1" },
  { id: "s101", name: "Aura Beauty Supply", contact: "Local Depot", phone: "061-521100", pan: "301234567", outstanding: 12000, products: 4, tenantId: "t2" },
  { id: "s102", name: "Lumina Cosmetics — Pokhara", contact: "Ramesh KC", phone: "061-522200", pan: "305678901", outstanding: 0, products: 3, tenantId: "t2" },
];

export const SALES_TEAM = [
  { id: "st1", name: "Prakash Gurung", route: "Kathmandu Central", visits: 12, orders: 8, collections: 185000, target: 250000, achieved: 74, tenantId: "t1" },
  { id: "st2", name: "Sita Magar", route: "Lalitpur", visits: 10, orders: 7, collections: 142000, target: 200000, achieved: 71, tenantId: "t1" },
  { id: "st3", name: "Hari Bahadur", route: "Bhaktapur", visits: 9, orders: 6, collections: 98000, target: 150000, achieved: 65, tenantId: "t1" },
  { id: "st4", name: "Maya Tamang", route: "Baneshwor–Koteshwor", visits: 11, orders: 9, collections: 210000, target: 220000, achieved: 95, tenantId: "t1" },
  { id: "st101", name: "Anita KC", route: "Lakeside–Baidam", visits: 6, orders: 4, collections: 42000, target: 80000, achieved: 53, tenantId: "t2" },
];

export const DELIVERIES = [
  { id: "d1", number: "DL-392", customer: "Nisha Karki", driver: "Ram Bahadur", status: "DELIVERED", items: 8, eta: "Done", tenantId: "t1" },
  { id: "d2", number: "DL-393", customer: "Aarati Shrestha", driver: "Ram Bahadur", status: "OUT_FOR_DELIVERY", items: 12, eta: "25 min", tenantId: "t1" },
  { id: "d3", number: "DL-394", customer: "Patan Beauty Studio", driver: "Krishna Shrestha", status: "SCHEDULED", items: 28, eta: "2:30 PM", tenantId: "t1" },
  { id: "d4", number: "DL-395", customer: "Sajha Bridal Studio", driver: "Krishna Shrestha", status: "SCHEDULED", items: 15, eta: "4:00 PM", tenantId: "t1" },
  { id: "d5", number: "DL-391", customer: "Riya Gurung", driver: "Ram Bahadur", status: "FAILED", items: 6, eta: "Retry", tenantId: "t1" },
  { id: "d101", number: "DL-P018", customer: "Anjali Rai", driver: "Gopal Thapa", status: "OUT_FOR_DELIVERY", items: 5, eta: "40 min", tenantId: "t2" },
  { id: "d102", number: "DL-P017", customer: "Sushma KC", driver: "Gopal Thapa", status: "SCHEDULED", items: 4, eta: "5:00 PM", tenantId: "t2" },
];

export const NOTIFICATIONS = [
  { id: "n1", type: "low_stock", title: "Review imported stock quantities", body: "Imported quantities are a source-site snapshot, not a physical stock count.", time: "12 min ago", read: false, tenantId: "t1" },
  { id: "n2", type: "overdue", title: "Overdue payment: Riya Gurung", body: "INV-2843 overdue by 1 day — Rs 45,000.", time: "1 hr ago", read: false, tenantId: "t1" },
  { id: "n3", type: "credit", title: "Credit limit warning: Priya Thapa", body: "Outstanding Rs 78,000 of Rs 100,000 limit (78%).", time: "2 hr ago", read: false, tenantId: "t1" },
  { id: "n4", type: "expiry", title: "Add batch and expiry details", body: "Check the packaging of received stock and record its batch and expiry date.", time: "3 hr ago", read: true, tenantId: "t1" },
  { id: "n5", type: "order", title: "Large order received", body: "SO-1191 from Patan Beauty Studio — Rs 142,000.", time: "4 hr ago", read: true, tenantId: "t1" },
  { id: "n6", type: "visit", title: "Missed visit: Priya Thapa", body: "Sita Magar skipped planned visit today.", time: "5 hr ago", read: true, tenantId: "t1" },
  { id: "n101", type: "order", title: "Order confirmed: Anjali Rai", body: "SO-P018 — Rs 12,500 ready for dispatch.", time: "20 min ago", read: false, tenantId: "t2" },
  { id: "n102", type: "credit", title: "Credit issued: Sushma KC", body: "INV-P041 due Rs 16,000.", time: "1 hr ago", read: false, tenantId: "t2" },
];

export const WAREHOUSES = [
  { id: "w1", name: "Main Store — Teku", code: "WH-TEKU", racks: 48, skus: 186, value: 14250000, utilization: 78, tenantId: "t1" },
  { id: "w2", name: "Baneshwor Store", code: "WH-BNE", racks: 24, skus: 94, value: 3200000, utilization: 62, tenantId: "t1" },
  { id: "w3", name: "Patan Stockroom", code: "WH-PTN", racks: 12, skus: 42, value: 1304200, utilization: 45, tenantId: "t1" },
  { id: "w101", name: "Beauty Store — Lakeside", code: "WH-PKR", racks: 16, skus: 38, value: 920000, utilization: 52, tenantId: "t2" },
];

export const EXPENSES = [
  { id: "e1", category: "Fuel", description: "Delivery van diesel", amount: 4500, date: "2026-08-03", status: "PAID", tenantId: "t1" },
  { id: "e2", category: "Salary", description: "Warehouse daily wages", amount: 12000, date: "2026-08-03", status: "APPROVED", tenantId: "t1" },
  { id: "e3", category: "Rent", description: "Baneshwor depot rent — Aug", amount: 45000, date: "2026-08-01", status: "PAID", tenantId: "t1" },
  { id: "e4", category: "Utilities", description: "Electricity — Teku WH", amount: 18500, date: "2026-08-02", status: "PAID", tenantId: "t1" },
  { id: "e101", category: "Fuel", description: "Scooter petrol — Lakeside route", amount: 1800, date: "2026-08-03", status: "PAID", tenantId: "t2" },
  { id: "e102", category: "Rent", description: "Pokhara depot rent — Aug", amount: 18000, date: "2026-08-01", status: "PAID", tenantId: "t2" },
];

export const NAV_SECTIONS = [
  {
    title: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" }],
  },
  {
    title: "Sales",
    items: [
      { href: "/sales/galla", label: "POS Counter", icon: "Zap" },
      { href: "/sales/phone", label: "Phone order", icon: "Phone" },
      { href: "/sales/all", label: "All sales", icon: "Receipt" },
      { href: "/orders", label: "Orders", icon: "ShoppingCart" },
      { href: "/delivery", label: "Delivery", icon: "Truck" },
      { href: "/analytics", label: "Analytics", icon: "BarChart3" },
    ],
  },
  {
    title: "Catalog",
    items: [
      { href: "/products", label: "Products", icon: "Package" },
      { href: "/inventory", label: "Inventory", icon: "Boxes" },
      { href: "/inventory/barcodes", label: "Barcodes", icon: "Barcode" },
      { href: "/customers", label: "Customers", icon: "Users" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/admin", label: "Admin", icon: "Shield" },
      { href: "/settings", label: "Settings", icon: "Settings" },
    ],
  },
];
