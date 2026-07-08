import { IsIn, IsOptional, IsString } from 'class-validator'

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  username?: string

  @IsOptional()
  @IsString()
  displayName?: string

  @IsOptional()
  @IsString()
  companyId?: string

  @IsOptional()
  @IsString()
  teamId?: string

  @IsOptional()
  @IsString()
  roleId?: string

  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED'
}
