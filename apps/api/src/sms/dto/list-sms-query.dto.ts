import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ORDER_STATUSES } from '../../orders/dto/order.validation';
import type { OrderStatus } from '../../orders/dto/order.validation';
import { SMS_STATUSES } from './sms.validation';
import type { SmsStatus } from './sms.validation';

export class ListSmsQueryDto {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsIn(SMS_STATUSES)
  status?: SmsStatus;

  @IsOptional()
  @IsIn(ORDER_STATUSES)
  orderStatus?: OrderStatus;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
