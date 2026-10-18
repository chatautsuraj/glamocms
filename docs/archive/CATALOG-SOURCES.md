# Glamo Nepal catalog

Imported on 17 September 2026 from https://www.glamonepal.com/shop and its public product endpoint, `/api/v1/products?sort=featured&page=1&limit=100`.

- 70 products, 44 brands, five categories; each demo store has an isolated copy.
- Actual names, SKUs, sizes, published NPR prices and product photos. Each product links to its source page.
- Photos are bundled locally as optimized WebP files. Source URLs are retained in `apps/web/src/lib/glamo-catalog.json`.
- Stock is a source-site snapshot, not verified physical stock. Prices and stock do not automatically synchronize.
- Unpublished barcode, batch, expiry, shade and opening-period details are left blank. Seller cost prices are excluded.
- Existing checkout tax settings still apply to the imported selling price.
- Saved custom products, edited products and products referenced by transactions are preserved during the catalog upgrade.

The app remains a browser-local demo; source product names do not constitute independent verification of product claims.

## Verification

17 automated tests passed, covering catalog prices/photos, safe migration, persistence, product editing, checkout, stock limits, tester/expiry restrictions and customer balances. Production build and TypeScript validation passed. Browser checks verified 70 gallery cards, brand search, successful cash checkout and mobile width.
