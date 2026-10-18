/** POS whatsapp endpoints — see POS-API-CONTRACT.md. */
import { api } from "./client";
import type { BroadcastInput, BroadcastResult, WaConversation, WaConversationDetail } from "./types";

const enc = encodeURIComponent;

export const whatsappApi = {
  conversations: (status: "open" | "handoff" | "all", page = 1) => api.list<WaConversation>("/pos/whatsapp/conversations", { status, page }),
  conversation: (waId: string) => api.get<WaConversationDetail>(`/pos/whatsapp/conversations/${enc(waId)}`),
  reply: (waId: string, text: string) => api.post<unknown>(`/pos/whatsapp/conversations/${enc(waId)}/reply`, { text }),
  resolve: (waId: string) => api.post<{ waId: string; state: string; handoff: boolean }>(`/pos/whatsapp/conversations/${enc(waId)}/resolve`, {}),
  broadcast: (body: BroadcastInput) => api.post<BroadcastResult>("/pos/whatsapp/broadcasts", body),
};


