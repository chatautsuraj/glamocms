import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReturnsService } from './returns.service';

class ReturnLineDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  qty!: number;
}

class CreateReturnDto {
  @IsString()
  orderId!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  items?: ReturnLineDto[];
}

@Controller('returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  list() {
    return this.returns.list();
  }

  @Post()
  create(@Body() dto: CreateReturnDto) {
    return this.returns.create(dto);
  }
}
