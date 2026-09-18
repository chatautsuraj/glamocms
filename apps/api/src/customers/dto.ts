import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderChannel } from '@prisma/client';

export class CreateCustomerDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(OrderChannel)
  sourceChannel?: OrderChannel;
}
