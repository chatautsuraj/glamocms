"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";

function useActiveTenantId() {
  return useAppStore((s) => s.activeTenantId);
}

function filterByTenant<T extends { tenantId: string }>(
  items: T[],
  tenantId: string | null
): T[] {
  if (!tenantId) return [];
  return items.filter((i) => i.tenantId === tenantId);
}

export function useTenantCustomers() {
  const tenantId = useActiveTenantId();
  const customers = useAppStore((s) => s.customers);
  return useMemo(() => filterByTenant(customers, tenantId), [customers, tenantId]);
}

export function useTenantProducts() {
  const tenantId = useActiveTenantId();
  const products = useAppStore((s) => s.products);
  return useMemo(() => filterByTenant(products, tenantId), [products, tenantId]);
}

export function useTenantCategories() {
  const tenantId = useActiveTenantId();
  const categories = useAppStore((s) => s.categories);
  return useMemo(() => {
    const list = filterByTenant(categories, tenantId);
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, tenantId]);
}

export function useTenantSuppliers() {
  const tenantId = useActiveTenantId();
  const suppliers = useAppStore((s) => s.suppliers);
  return useMemo(() => filterByTenant(suppliers, tenantId), [suppliers, tenantId]);
}

export function useTenantOrders() {
  const tenantId = useActiveTenantId();
  const orders = useAppStore((s) => s.orders);
  return useMemo(() => filterByTenant(orders, tenantId), [orders, tenantId]);
}

export function useTenantPurchaseOrders() {
  const tenantId = useActiveTenantId();
  const purchaseOrders = useAppStore((s) => s.purchaseOrders);
  return useMemo(
    () => filterByTenant(purchaseOrders, tenantId),
    [purchaseOrders, tenantId]
  );
}

export function useTenantInvoices() {
  const tenantId = useActiveTenantId();
  const invoices = useAppStore((s) => s.invoices);
  return useMemo(() => filterByTenant(invoices, tenantId), [invoices, tenantId]);
}

export function useTenantExpenses() {
  const tenantId = useActiveTenantId();
  const expenses = useAppStore((s) => s.expenses);
  return useMemo(() => filterByTenant(expenses, tenantId), [expenses, tenantId]);
}

export function useTenantBranches() {
  const tenantId = useActiveTenantId();
  const branches = useAppStore((s) => s.branches);
  return useMemo(() => filterByTenant(branches, tenantId), [branches, tenantId]);
}

export function useTenantPriceLists() {
  const tenantId = useActiveTenantId();
  const priceLists = useAppStore((s) => s.priceLists);
  return useMemo(
    () => priceLists.filter((l) => !tenantId || l.tenantId === tenantId),
    [priceLists, tenantId]
  );
}

export function useTenantPriceListItems() {
  const priceLists = useTenantPriceLists();
  const priceListItems = useAppStore((s) => s.priceListItems);
  const listIds = useMemo(() => new Set(priceLists.map((l) => l.id)), [priceLists]);
  return useMemo(
    () => priceListItems.filter((i) => listIds.has(i.priceListId)),
    [priceListItems, listIds]
  );
}

export function useTenantSpecialPrices() {
  const tenantId = useActiveTenantId();
  const specialPrices = useAppStore((s) => s.specialPrices);
  return useMemo(
    () => specialPrices.filter((s) => !tenantId || !s.tenantId || s.tenantId === tenantId),
    [specialPrices, tenantId]
  );
}

/** Filter static mock rows that carry tenantId. */
export function useTenantFiltered<T extends { tenantId: string }>(items: T[]): T[] {
  const tenantId = useActiveTenantId();
  return useMemo(() => filterByTenant(items, tenantId), [items, tenantId]);
}
