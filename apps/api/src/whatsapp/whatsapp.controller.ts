import {
  Body,
  Controller,
  Get,
  Headers,
  Logger,
  Post,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/public.decorator';
import { WhatsappService } from './whatsapp.service';

/**
 * Meta WhatsApp Cloud API webhook + n8n-friendly order intake.
 * Verify token: WHATSAPP_VERIFY_TOKEN
 */
@Controller('channels/whatsapp')
export class WhatsappController {
  private readonly log = new Logger(WhatsappController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsappService,
  ) {}

  @Public()
  @Get('webhook')
  verify(
    @Res() res: Response,
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    const expected = this.config.get<string>('WHATSAPP_VERIFY_TOKEN') ?? 'glamo-verify';
    if (mode === 'subscribe' && token === expected) {
      return res.status(200).send(challenge ?? '');
    }
    throw new UnauthorizedException('WhatsApp verify failed');
  }

  @Public()
  @Post('webhook')
  async inbound(@Body() body: Record<string, unknown>) {
    this.log.log(`WhatsApp webhook: ${JSON.stringify(body).slice(0, 500)}`);
    return this.whatsapp.handleInbound(body);
  }

  /** n8n / website → same inventory via Nest order create helper */
  @Post('orders')
  createFromChannel(
    @Body()
    body: {
      customerName: string;
      customerPhone?: string;
      items: Array<{ productId: string; qty: number }>;
      deliveryAddress?: string;
      notes?: string;
    },
    @Headers('x-api-key') _key?: string,
  ) {
    return this.whatsapp.createChannelOrder(body);
  }
}
