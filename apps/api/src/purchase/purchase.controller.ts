import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseService } from './purchase.service';

class PurchaseLineDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(1)
  qty!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;
}

class ReceivePurchaseDto {
  @IsString()
  supplierName!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  lines!: PurchaseLineDto[];
}

@Controller('purchase')
export class PurchaseController {
  constructor(private readonly purchase: PurchaseService) {}

  @Get()
  list() {
    return this.purchase.list();
  }

  @Post('receive')
  receive(@Body() dto: ReceivePurchaseDto) {
    return this.purchase.receive(dto);
  }
}
