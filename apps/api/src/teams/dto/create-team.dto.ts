import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
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

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @IsOptional()
  @IsIn(['INHERIT', 'ALLOW_LIST'])
  countryPolicyMode?: 'INHERIT' | 'ALLOW_LIST';

  @IsOptional()
  @IsArray()
  @Transform(normalizeCountryCodes)
  @IsString({ each: true })
  @Matches(ISO_COUNTRY_PATTERN, { each: true })
  @ArrayUnique()
  countryCodes?: string[];
}
