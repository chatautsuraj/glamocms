import type { StoreProfile } from "@/lib/api/types";

/** Seller block printed on bills and delivery notes — from store settings (StoreProfile). */
export type BillCompany = {
  name: string;
  /** Printed under the name only when set and different from it. */
  legalName?: string;
  address: string;
  phone: string;
  pan: string;
  vat?: string;
  email?: string;
};

export function companyFromStore(store: Pick<StoreProfile, "name" | "legalName" | "address" | "phone" | "pan" | "vatNumber" | "email">): BillCompany {
  return {
    name: store.name,
    legalName: store.legalName,
    address: store.address,
    phone: store.phone,
    pan: store.pan,
    vat: store.vatNumber,
    email: store.email,
  };
}
