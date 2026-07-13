import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { POSITIVE_WALLET_AMOUNT_PATTERN } from '../wallet-decimal.util';

export function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export function uppercaseCurrency({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

const CURRENCY_PATTERN = /^[A-Z]{3,10}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9:_-]{8,128}$/;

export class CreateWalletAccountDto {
  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @Transform(uppercaseCurrency)
  @IsString()
  @Matches(CURRENCY_PATTERN, {
    message: 'currency must be 3-10 uppercase letters',
  })
  currency!: string;

  @IsOptional()
  @IsString()
  userId?: string | null;
}

export class RechargeWalletAccountDto {
  @Transform(trimString)
  @IsString()
  @Matches(POSITIVE_WALLET_AMOUNT_PATTERN, {
    message: 'amount must be a positive decimal with up to 4 decimal places',
  })
  amount!: string;

  @Transform(trimString)
  @IsString()
  @Matches(IDEMPOTENCY_KEY_PATTERN, {
    message: 'idempotencyKey must be 8-128 characters',
  })
  idempotencyKey!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class AdjustWalletAccountDto {
  @IsIn(['CREDIT', 'DEBIT'])
  direction!: 'CREDIT' | 'DEBIT';

  @Transform(trimString)
  @IsString()
  @Matches(POSITIVE_WALLET_AMOUNT_PATTERN, {
    message: 'amount must be a positive decimal with up to 4 decimal places',
  })
  amount!: string;

  @Transform(trimString)
  @IsString()
  @Matches(IDEMPOTENCY_KEY_PATTERN, {
    message: 'idempotencyKey must be 8-128 characters',
  })
  idempotencyKey!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  remark!: string;
}

export class ListWalletTransactionsQueryDto {
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
