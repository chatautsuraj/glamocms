# Audit and test results

Verified on 17 September 2026 on Windows using the production Next.js build and headless Microsoft Edge.

## Results

| Check | Result |
| --- | --- |
| Production build, all 28 generated pages | Passed |
| TypeScript and ESLint checks | Passed |
| Automated business-flow tests | 15 passed, 0 failed |
| Main authenticated route checks | 15 passed |
| Browser uncaught page errors during route checks | None |
| Desktop visual review | Passed |
| Mobile checkout at 390 × 844 | Passed; document width equals viewport width |
| Mobile menu opening and route navigation | Passed |
| Product create, edit and reload | Passed; shade, batch, tester and expiry retained |
| Counter cash sale and stock after reload | Passed; test product stock changed from 10 to 9 |
| Tester product at checkout | Passed; marked TESTER and disabled |
| Expired product at checkout | Passed; marked EXPIRED and disabled |
| Product CSV generation | Passed; 22 rows plus header, with shade/category/counter/price values |
| Automated CSV file save | Not verified; the test browser canceled the download |

Main routes checked: dashboard, products, inventory, beauty counter, sales, customers, orders, purchase, suppliers, expenses, pricing, reports, analytics, notifications and settings. This is a rendering/navigation check for those routes, not exhaustive testing of every original feature.

## Automated test coverage

The included `apps/web/tests/cosmetics.test.ts` checks date-boundary expiry handling; testers; unique cosmetic SKUs; new-product metadata; editing; storage rehydration; duplicate-SKU rejection; cash checkout and customer history; overselling; duplicate cart rows; expired/tester sales; cross-store products; invalid quantities; customer pricing; and credit/payment balances.

## Corrections made during the audit

- Product creation now saves the new cosmetics metadata rather than dropping it.
- Product editing accepts cosmetics fields and the original counter/image fields.
- Checkout validates total quantities before mutating invoices or stock.
- Paid sales update the customer's purchase history as well as credit sales.
- The desktop sidebar becomes a mobile menu on narrow screens.
- Cosmetic product names and batch dates have enough table space.
- Product form labels and icon-only product actions have accessible names.
- Chart tooltip types and legacy lint errors were corrected so the build passes.
- Cosmetic CSV columns now export their values rather than blank cells.
- CSV blob URLs remain available long enough for the download to start.

## Practical limits

The source app remains a local demo with browser storage, demo authentication and sample historical analytics. Test success does not make it a production-secure retail backend. One batch is stored per SKU. Review real prices, tax settings and product shelf-life information before replacing the demo catalog.

The original Downloads copy was not modified. Browser tests used an isolated test session; temporary test products were cleared from that session before final screenshots.

The CSV content was inspected directly from the generated browser Blob. Its content is correct; the automated browser's file-save attempt was canceled, so a manual download check remains.

## Glamo Nepal update — 17 September 2026
70 real products and photos imported. 17 automated tests passed. Browser verified brand search, all 70 gallery cards, cash sale (Rs 1,800 plus configured VAT = Rs 2,034), stock decrement, and mobile layout at 390px with no horizontal overflow. See CATALOG-SOURCES.md.

