import { IsIn, IsOptional, IsString, MinLength } from 'class-validator'

export class CreateUserDto {
  @IsString()
  username: string

  @IsString()
  @MinLength(6)
  password: string

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
