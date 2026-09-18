import { Module } from '@nestjs/common';
import { DeliveryPartnerService } from './delivery-partner.service';

@Module({
  providers: [DeliveryPartnerService],
  exports: [DeliveryPartnerService],
})
export class DeliveryModule {}
