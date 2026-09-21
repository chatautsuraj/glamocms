import { Module } from '@nestjs/common';
import { TillController } from './till.controller';
import { TillService } from './till.service';

@Module({
  controllers: [TillController],
  providers: [TillService],
  exports: [TillService],
})
export class TillModule {}
