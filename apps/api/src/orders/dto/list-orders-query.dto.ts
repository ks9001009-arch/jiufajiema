import { IsIn, IsOptional, IsString } from 'class-validator';
import { ORDER_STATUSES } from './order.validation';
import type { OrderStatus } from './order.validation';

export class ListOrdersQueryDto {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  userId?: string;
}
