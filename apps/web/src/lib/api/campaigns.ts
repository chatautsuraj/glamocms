/** POS email campaign endpoints. */
import { api } from "./client";

export type CampaignAudience = "customers" | "registered" | "subscribers" | "all";

export interface CampaignInput {
  subject: string;
  previewText?: string;
  body: string;
  audience: CampaignAudience;
}

export interface AudienceCounts {
  customers: number;
  /** Older API versions don't send this; treat as 0. */
  registered?: number;
  subscribers: number;
  all: number;
}

export interface Campaign {
  id: string;
  subject: string;
  previewText: string;
  body: string;
  audience: CampaignAudience;
  audienceLabel: string;
  status: "draft" | "sending" | "sent" | "failed";
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  error: string | null;
  createdAt: string | null;
  sentAt: string | null;
}

export interface SendResult {
  id: string;
  recipients: number;
  sent: number;
  failed: number;
  error: string | null;
}

export const campaignsApi = {
  list: () => api.get<Campaign[]>("/pos/campaigns"),
  audience: () => api.get<AudienceCounts>("/pos/campaigns/audience"),
  create: (body: CampaignInput) => api.post<Campaign>("/pos/campaigns", body),
  sendTest: (body: CampaignInput & { to?: string }) => api.post<{ to: string }>("/pos/campaigns/test", body),
  send: (id: string) => api.post<SendResult>(`/pos/campaigns/${encodeURIComponent(id)}/send`),
};
