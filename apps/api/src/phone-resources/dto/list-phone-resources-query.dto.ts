import { IsIn, IsOptional, IsString } from 'class-validator';
import { PHONE_RESOURCE_STATUSES } from './phone-resource.validation';
import type { PhoneResourceStatus } from './phone-resource.validation';

export class ListPhoneResourcesQueryDto {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  providerId?: string;

  @IsOptional()
  @IsIn(PHONE_RESOURCE_STATUSES)
  status?: PhoneResourceStatus;
}
