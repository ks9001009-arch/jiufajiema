import { IsOptional, IsString } from 'class-validator'

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  companyId?: string
}
