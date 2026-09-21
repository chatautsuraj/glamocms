import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentsService } from './payments.service';

class ConfirmPaymentDto {
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  externalRef?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  raw?: string;
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@Query('orderId') orderId?: string) {
    return this.payments.list(orderId);
  }

  /** Manual Fonepay / QR confirmation from POS (cashier taps Confirm). */
  @Post('confirm')
  confirm(@Body() dto: ConfirmPaymentDto) {
    return this.payments.confirm(dto);
  }

  /** Webhook-style confirm (n8n / Fonepay callback). Same body as confirm. */
  @Post('webhook/fonepay')
  webhook(@Body() dto: ConfirmPaymentDto) {
    return this.payments.confirm({
      ...dto,
      provider: dto.provider ?? 'fonepay',
    });
  }
}
