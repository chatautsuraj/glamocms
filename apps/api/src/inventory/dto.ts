import { IsInt, IsOptional, IsString } from 'class-validator';

export class AdjustStockDto {
  @IsString()
  productId!: string;

  /** Positive = receive, negative = remove */
  @IsInt()
  qty!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
