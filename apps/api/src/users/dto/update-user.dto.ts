import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  roleId?: string;
}
