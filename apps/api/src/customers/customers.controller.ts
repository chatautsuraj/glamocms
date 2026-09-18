import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CreateCustomerDto } from './dto';
import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@Query('phone') phone?: string) {
    return this.customers.findAll(phone);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }
}
