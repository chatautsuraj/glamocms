import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type DispatchRequest = {
  orderId: string;
  amount: number;
  customerName: string;
  customerPhone?: string | null;
  address: string;
  notes?: string | null;
};

export type DispatchResult = {
  partner: string;
  externalId: string;
  status: string;
  raw?: unknown;
};

/**
 * Pluggable delivery partner. Set DELIVERY_PARTNER=stub|http and
 * DELIVERY_PARTNER_URL + DELIVERY_PARTNER_KEY when ready to connect Pathao / others.
 */
@Injectable()
export class DeliveryPartnerService {
  private readonly log = new Logger(DeliveryPartnerService.name);

  constructor(private readonly config: ConfigService) {}

  configured(): boolean {
    const partner = (this.config.get<string>('DELIVERY_PARTNER') ?? 'stub').toLowerCase();
    if (partner === 'stub' || partner === 'manual') return false;
    return Boolean(this.config.get<string>('DELIVERY_PARTNER_URL'));
  }

  partnerName(): string {
    return (this.config.get<string>('DELIVERY_PARTNER') ?? 'stub').toLowerCase();
  }

  async dispatch(req: DispatchRequest): Promise<DispatchResult> {
    const partner = this.partnerName();
    const url = this.config.get<string>('DELIVERY_PARTNER_URL');
    const key = this.config.get<string>('DELIVERY_PARTNER_KEY');

    if (!url || partner === 'stub' || partner === 'manual') {
      this.log.warn(`Delivery partner not configured — manual dispatch for ${req.orderId}`);
      return {
        partner: 'manual',
        externalId: `MANUAL-${req.orderId.slice(0, 8)}`,
        status: 'manual_pending',
      };
    }

    const res = await fetch(`${url.replace(/\/$/, '')}/shipments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: `Bearer ${key}`, 'X-API-Key': key } : {}),
      },
      body: JSON.stringify({
        reference: req.orderId,
        amount: req.amount,
        customer: { name: req.customerName, phone: req.customerPhone },
        address: req.address,
        notes: req.notes,
      }),
    });

    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.log.error(`Partner dispatch failed: ${res.status} ${JSON.stringify(raw)}`);
      throw new Error(
        typeof (raw as { message?: string }).message === 'string'
          ? (raw as { message: string }).message
          : `Delivery partner error (${res.status})`,
      );
    }

    const data = raw as { id?: string; trackingId?: string; status?: string };
    return {
      partner,
      externalId: String(data.trackingId ?? data.id ?? `EXT-${req.orderId.slice(0, 8)}`),
      status: String(data.status ?? 'dispatched'),
      raw,
    };
  }
}
