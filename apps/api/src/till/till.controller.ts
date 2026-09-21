import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TillService } from './till.service';

class OpenTillDto {
  @IsString()
  cashierName!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  openingFloat?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

class CloseTillDto {
  @IsNumber()
  @Min(0)
  closingCash!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

@Controller('till')
export class TillController {
  constructor(private readonly till: TillService) {}

  @Get('current')
  current() {
    return this.till.currentOpen();
  }

  @Get()
  list() {
    return this.till.list();
  }

  @Post('open')
  open(@Body() dto: OpenTillDto) {
    return this.till.open(dto);
  }

  @Post(':id/close')
  close(@Param('id') id: string, @Body() dto: CloseTillDto) {
    return this.till.close(id, dto);
  }
}
