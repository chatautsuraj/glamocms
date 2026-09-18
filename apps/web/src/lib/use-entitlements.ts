"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import {
  canAccessAdminPanelRole,
  canManageTenantUsersRole,
  getEffectiveFeatures,
  isPlatformAdminRole,
  userCanDeleteRecords,
  userCanEditRecords,
  type FeatureKey,
} from "@/lib/features";
import {
  canAccessAdminPanel,
  canManageTenantUsers,
  canOnboardClients,
  getManagedTenants,
  useAppStore,
  type Tenant,
  type User,
} from "@/lib/store";

export function useStoreUser(): User | null {
  const { user } = useAuth();
  const users = useAppStore((s) => s.users);
  return useMemo(() => {
    if (!user) return null;
    return users.find((u) => u.id === user.id || u.email === user.email) ?? null;
  }, [user, users]);
}

export function useActiveTenantId(): string | null {
  return useAppStore((s) => s.activeTenantId);
}

export function useCurrentTenant(): Tenant | null {
  const activeTenantId = useActiveTenantId();
  const tenants = useAppStore((s) => s.tenants);
  return useMemo(() => {
    if (!activeTenantId) return null;
    const tenant = tenants.find((t) => t.id === activeTenantId);
    if (!tenant || tenant.active === false) return null;
    return tenant;
  }, [activeTenantId, tenants]);
}

/** Client-level VAT for the active workspace (default off — not all goods are VATable). */
export function useVatEnabled(): boolean {
  const tenant = useCurrentTenant();
  return tenant?.vatEnabled === true;
}

export function useManagedTenants(): Tenant[] {
  const storeUser = useStoreUser();
  const tenants = useAppStore((s) => s.tenants);
  return useMemo(() => getManagedTenants(storeUser, tenants), [storeUser, tenants]);
}

export function useCanSwitchTenant(): boolean {
  const storeUser = useStoreUser();
  const managed = useManagedTenants();
  return canAccessAdminPanel(storeUser) && managed.length > 1;
}

export function useEffectiveFeatures(): FeatureKey[] {
  const { user } = useAuth();
  const storeUser = useStoreUser();
  const tenant = useCurrentTenant();

  return useMemo(() => {
    if (!user) return [];
    const tenantFeatures = tenant?.enabledFeatures ?? [];
    const effective = getEffectiveFeatures(tenantFeatures, storeUser?.enabledFeatures);

    if (canAccessAdminPanel(storeUser) || canAccessAdminPanelRole(user.role, user.tenantId)) {
      return [...effective, "admin"];
    }
    return effective;
  }, [user, storeUser, tenant]);
}

export function useCanAccessAdmin(): boolean {
  const { user } = useAuth();
  const storeUser = useStoreUser();
  if (storeUser) return canAccessAdminPanel(storeUser);
  return canAccessAdminPanelRole(user?.role, user?.tenantId);
}

export function useCanOnboardClients(): boolean {
  const storeUser = useStoreUser();
  return canOnboardClients(storeUser);
}

export function useCanManageTenantUsers(): boolean {
  const storeUser = useStoreUser();
  const { user } = useAuth();
  if (storeUser) return canManageTenantUsers(storeUser);
  return canManageTenantUsersRole(user?.role) && !!user?.tenantId;
}

export function useIsPlatformAdmin(): boolean {
  const { user } = useAuth();
  const storeUser = useStoreUser();
  return isPlatformAdminRole(user?.role) || isPlatformAdminRole(storeUser?.role);
}

export function useCanEditRecords(): boolean {
  const storeUser = useStoreUser();
  return userCanEditRecords(storeUser);
}

export function useCanDeleteRecords(): boolean {
  const storeUser = useStoreUser();
  return userCanDeleteRecords(storeUser);
}

export function useSetActiveTenant() {
  return useAppStore((s) => s.setActiveTenantId);
}
