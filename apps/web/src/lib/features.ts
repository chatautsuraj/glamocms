export const FEATURE_KEYS = [
  "dashboard",
  "analytics",
  "notifications",
  "sales",
  "galla",
  "orders",
  "customers",
  "products",
  "inventory",
  "purchase",
  "suppliers",
  "expenses",
  "reports",
  "settings",
  "admin",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureDef = {
  key: FeatureKey;
  label: string;
};

export type FeatureGroup = {
  title: string;
  features: FeatureDef[];
};

/** Feature groups aligned with nav sections (excludes platform-only admin). */
export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: "Overview",
    features: [
      { key: "dashboard", label: "Dashboard" },
      { key: "analytics", label: "Analytics" },
      { key: "notifications", label: "Notifications" },
    ],
  },
  {
    title: "Commerce",
    features: [
      { key: "sales", label: "Sales" },
      { key: "galla", label: "Beauty Counter / POS" },
      { key: "orders", label: "Orders" },
      { key: "customers", label: "Customers" },
    ],
  },
  {
    title: "Catalog & Stock",
    features: [
      { key: "products", label: "Products" },
      { key: "inventory", label: "Inventory" },
    ],
  },
  {
    title: "Supply",
    features: [
      { key: "purchase", label: "Purchase" },
      { key: "suppliers", label: "Suppliers" },
    ],
  },
  {
    title: "Finance & Insights",
    features: [
      { key: "expenses", label: "Expenses" },
      { key: "reports", label: "Reports" },
      { key: "settings", label: "Settings" },
    ],
  },
];

/** All features a retailer tenant can be granted (not platform admin). */
export const TENANT_FEATURE_KEYS: FeatureKey[] = FEATURE_GROUPS.flatMap((g) =>
  g.features.map((f) => f.key)
);

export const FULL_TENANT_FEATURES: FeatureKey[] = [...TENANT_FEATURE_KEYS];

export const STARTER_TENANT_FEATURES: FeatureKey[] = [
  "dashboard",
  "galla",
  "orders",
  "customers",
  "products",
  "inventory",
];

/** Removed modules — filtered out of persisted feature lists. */
const REMOVED_FEATURES = new Set([
  "ai",
  "warehouse",
  "sales-team",
  "salesperson",
  "finance",
  "analytics",
  "notifications",
  "sales",
  "purchase",
  "suppliers",
  "expenses",
  "reports",
  "settings",
  "admin",
]);

/** Map legacy feature keys to current ones. */
export function normalizeFeatureKey(key: string): FeatureKey | null {
  if (key === "finance") return "expenses";
  if (REMOVED_FEATURES.has(key) && key !== "finance") return null;
  if ((FEATURE_KEYS as readonly string[]).includes(key)) return key as FeatureKey;
  return null;
}

export function normalizeFeatureList(keys: string[] | null | undefined): FeatureKey[] | null {
  if (keys == null) return null;
  const out: FeatureKey[] = [];
  const seen = new Set<string>();
  for (const raw of keys) {
    const mapped = normalizeFeatureKey(raw);
    if (!mapped || seen.has(mapped)) continue;
    seen.add(mapped);
    out.push(mapped);
  }
  return out;
}

/** Longest-prefix first so /sales/galla maps to galla, not sales. */
const HREF_FEATURE_MAP: { href: string; feature: FeatureKey }[] = [
  { href: "/sales/galla", feature: "galla" },
  { href: "/dashboard", feature: "dashboard" },
  { href: "/notifications", feature: "notifications" },
  { href: "/analytics", feature: "analytics" },
  { href: "/customers", feature: "customers" },
  { href: "/inventory", feature: "inventory" },
  { href: "/suppliers", feature: "suppliers" },
  { href: "/purchase", feature: "purchase" },
  { href: "/products", feature: "products" },
  { href: "/settings", feature: "settings" },
  { href: "/expenses", feature: "expenses" },
  { href: "/finance", feature: "expenses" },
  { href: "/reports", feature: "reports" },
  { href: "/orders", feature: "orders" },
  { href: "/delivery", feature: "orders" },
  { href: "/admin", feature: "admin" },
  { href: "/sales", feature: "sales" },
];

export function hrefToFeature(href: string): FeatureKey | null {
  const path = href.split("?")[0] || href;
  for (const entry of HREF_FEATURE_MAP) {
    if (path === entry.href || path.startsWith(`${entry.href}/`)) {
      return entry.feature;
    }
  }
  return null;
}

export function pathToFeature(pathname: string): FeatureKey | null {
  return hrefToFeature(pathname);
}

/**
 * Effective features = intersection of tenant features and user features.
 * null / undefined user features → inherit all tenant features.
 */
export function getEffectiveFeatures(
  tenantFeatures: string[],
  userFeatures: string[] | null | undefined
): FeatureKey[] {
  const tenantNormalized = normalizeFeatureList(tenantFeatures) ?? [];
  const tenantSet = new Set(tenantNormalized);
  if (userFeatures == null) {
    return TENANT_FEATURE_KEYS.filter((k) => tenantSet.has(k));
  }
  const userNormalized = normalizeFeatureList(userFeatures) ?? [];
  const userSet = new Set(userNormalized);
  return TENANT_FEATURE_KEYS.filter((k) => tenantSet.has(k) && userSet.has(k));
}

export function hasFeature(
  effective: string[],
  feature: FeatureKey | null
): boolean {
  if (!feature) return true;
  if (feature === "admin") return effective.includes("admin");
  return effective.includes(feature);
}

/** Super admin — full platform access. */
export function isPlatformAdminRole(role: string | undefined | null): boolean {
  return role === "PLATFORM_ADMIN";
}

/** @deprecated Agency admins removed from primary hierarchy. */
export function isAgencyAdminRole(
  role: string | undefined | null,
  tenantId: string | null | undefined
): boolean {
  return role === "ADMIN" && (tenantId == null || tenantId === "");
}

/** Store admin panel: OWNER or company ADMIN (Glamo single-store). */
export function canAccessAdminPanelRole(
  role: string | undefined | null,
  _tenantId?: string | null
): boolean {
  void _tenantId;
  return role === "OWNER" || role === "ADMIN";
}

/** Client OWNER or company ADMIN can manage tenant users. */
export function canManageTenantUsersRole(role: string | undefined | null): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** @deprecated Prefer canAccessAdminPanelRole — OWNER no longer gets /admin. */
export function canManageAdmin(role: string | undefined | null): boolean {
  return role === "PLATFORM_ADMIN";
}

export function roleDisplayLabel(role: string | undefined | null): string {
  if (role === "PLATFORM_ADMIN") return "Staff";
  if (role === "ADMIN") return "Admin";
  if (role === "OWNER") return "Owner";
  return role ?? "Staff";
}

export function featureLabel(key: string): string {
  for (const group of FEATURE_GROUPS) {
    const found = group.features.find((f) => f.key === key);
    if (found) return found.label;
  }
  if (key === "admin") return "Admin";
  if (key === "finance") return "Expenses";
  return key;
}

/** Owners / Super admin always have edit rights; others use canEdit flag. */
export function userCanEditRecords(user: {
  role?: string | null;
  canEdit?: boolean;
} | null): boolean {
  if (!user) return false;
  if (user.role === "PLATFORM_ADMIN" || user.role === "OWNER" || user.role === "ADMIN") {
    return true;
  }
  return user.canEdit !== false;
}

/** Owners / Super admin always have delete rights; others use canDelete flag. */
export function userCanDeleteRecords(user: {
  role?: string | null;
  canDelete?: boolean;
} | null): boolean {
  if (!user) return false;
  if (user.role === "PLATFORM_ADMIN" || user.role === "OWNER" || user.role === "ADMIN") {
    return true;
  }
  return user.canDelete === true;
}
