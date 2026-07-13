import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import {
  DECIMAL_AMOUNT_PATTERN,
  trimString,
} from './order.validation';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @IsString()
  @IsNotEmpty()
  providerId: string;

  @IsString()
  @IsNotEmpty()
  phoneResourceId: string;

  @IsOptional()
  @IsString()
  userId?: string | null;

  @Transform(trimString)
  @IsString()
  @Matches(DECIMAL_AMOUNT_PATTERN, {
    message: 'amount must be a non-negative decimal with up to 4 decimals',
  })
  amount: string;
}
