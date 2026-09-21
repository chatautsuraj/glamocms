import { Injectable, Logger } from '@nestjs/common';
import { OrderChannel, PaymentStatus } from '@prisma/client';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class WhatsappService {
  private readonly log = new Logger(WhatsappService.name);

  constructor(private readonly orders: OrdersService) {}

  async handleInbound(body: Record<string, unknown>) {
    // Meta payload shape — extract text messages for logging / future NLP
    const entry = (body as { entry?: unknown[] }).entry;
    this.log.debug(`entries=${Array.isArray(entry) ? entry.length : 0}`);
    return { ok: true, received: true };
  }

  createChannelOrder(dto: {
    customerName: string;
    customerPhone?: string;
    items: Array<{ productId: string; qty: number }>;
    deliveryAddress?: string;
    notes?: string;
  }) {
    return this.orders.create({
      channel: OrderChannel.whatsapp,
      paymentStatus: PaymentStatus.unpaid,
      customer: {
        name: dto.customerName,
        phone: dto.customerPhone,
      },
      deliveryAddress: dto.deliveryAddress,
      deliveryNotes: dto.notes,
      items: dto.items.map((i) => ({ productId: i.productId, qty: i.qty })),
    });
  }
}
