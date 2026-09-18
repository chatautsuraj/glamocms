import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { FulfillmentStatus, OrderChannel, PaymentStatus } from '@prisma/client';
import { CreateOrderDto, UpdateOrderDto } from './dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(
    @Query('channel') channel?: OrderChannel,
    @Query('paymentStatus') paymentStatus?: PaymentStatus,
    @Query('fulfillmentStatus') fulfillmentStatus?: FulfillmentStatus,
  ) {
    return this.orders.findAll(channel, paymentStatus, fulfillmentStatus);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.orders.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.orders.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.orders.update(id, dto);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.orders.cancel(id);
  }

  @Post(':id/dispatch')
  dispatch(@Param('id') id: string) {
    return this.orders.dispatchToPartner(id);
  }
}
