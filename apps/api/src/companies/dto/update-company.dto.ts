import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

const ISO_COUNTRY_PATTERN = /^[A-Z]{2}$/;

function normalizeCountryCodes({ value }: { value: unknown }) {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((item) =>
    typeof item === 'string' ? item.trim().toUpperCase() : item,
  );
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';

  @IsOptional()
  @IsArray()
  @Transform(normalizeCountryCodes)
  @IsString({ each: true })
  @Matches(ISO_COUNTRY_PATTERN, { each: true })
  @ArrayUnique()
  countryCodes?: string[];
}
