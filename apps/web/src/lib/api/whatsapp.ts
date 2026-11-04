/** POS whatsapp endpoints — see POS-API-CONTRACT.md. */
import { api, request } from "./client";
import type {
  BroadcastInput,
  BroadcastResult,
  WaComplaint,
  WaComplaintList,
  WaConversation,
  WaConversationDetail,
  WaConversionAnalytics,
} from "./types";

const enc = encodeURIComponent;

export type WaComplaintStatus = "open" | "in_progress" | "resolved" | "closed";

export type WaComplaintQuery = {
  status?: WaComplaintStatus;
  severity?: "normal" | "high";
  category?: string;
  page?: number;
  limit?: number;
};

export interface WaComplaintUpdate {
  status?: WaComplaintStatus;
  assignedTo?: string | null;
  resolutionNote?: string | null;
}

export const whatsappApi = {
  conversations: (status: "open" | "handoff" | "all", page = 1) => api.list<WaConversation>("/pos/whatsapp/conversations", { status, page }),
  conversation: (waId: string) => api.get<WaConversationDetail>(`/pos/whatsapp/conversations/${enc(waId)}`),
  reply: (waId: string, text: string) => api.post<unknown>(`/pos/whatsapp/conversations/${enc(waId)}/reply`, { text }),
  resolve: (waId: string) => api.post<{ waId: string; state: string; handoff: boolean }>(`/pos/whatsapp/conversations/${enc(waId)}/resolve`, {}),
  analytics: (days = 2) => api.get<WaConversionAnalytics>("/pos/whatsapp/analytics", { days }),
  complaints: (query: WaComplaintQuery = {}) => request<WaComplaintList>("GET", "/pos/whatsapp/complaints", { query }),
  updateComplaint: (id: string, patch: WaComplaintUpdate) =>
    api.patch<WaComplaint>(`/pos/whatsapp/complaints/${enc(id)}`, patch),
  broadcast: (body: BroadcastInput) => api.post<BroadcastResult>("/pos/whatsapp/broadcasts", body),
};
