/** POS staff endpoints — see POS-API-CONTRACT.md. */
import { api } from "./client";
import type { StaffUser } from "./types";

const enc = encodeURIComponent;

export const staffApi = {
  list: () => api.get<StaffUser[]>("/pos/staff"),
  create: (body: { email: string; name?: string; role: string }) => api.post<StaffUser>("/pos/staff", body),
  update: (id: string, body: { role?: string; isActive?: boolean }) => api.patch<StaffUser>(`/pos/staff/${enc(id)}`, body),
};
