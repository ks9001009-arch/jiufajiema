import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import {
  DECIMAL_COST_PATTERN,
  E164_PHONE_PATTERN,
  ISO_COUNTRY_PATTERN,
  PHONE_RESOURCE_STATUSES,
  trimString,
  uppercaseString,
} from './phone-resource.validation';
import type { PhoneResourceStatus } from './phone-resource.validation';

export class CreatePhoneResourceDto {
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  providerId: string;

  @Transform(trimString)
  @IsString()
  @Matches(E164_PHONE_PATTERN, {
    message: 'phone must be a valid E.164 number',
  })
  phone: string;

  @IsOptional()
  @Transform(uppercaseString)
  @IsString()
  @Matches(ISO_COUNTRY_PATTERN, {
    message: 'country must be a two-letter ISO country code',
  })
  country?: string | null;

  @Transform(trimString)
  @IsString()
  @Matches(DECIMAL_COST_PATTERN, {
    message: 'cost must be a non-negative decimal with up to 4 decimals',
  })
  cost: string;

  @IsOptional()
  @IsIn(PHONE_RESOURCE_STATUSES)
  status?: PhoneResourceStatus;
}
