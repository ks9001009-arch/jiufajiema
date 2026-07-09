import { IsString, MinLength } from 'class-validator';

export class ResetUserPasswordDto {
  @IsString()
  @MinLength(6, { message: '密码长度不能少于 6 位' })
  password: string;
}
