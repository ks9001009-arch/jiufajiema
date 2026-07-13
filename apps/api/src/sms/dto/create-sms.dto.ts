import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { trimString } from '../../orders/dto/order.validation';

@ValidatorConstraint({ name: 'smsCodeOrContent', async: false })
class SmsCodeOrContentConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args?: ValidationArguments) {
    const obj = args?.object as CreateSmsDto | undefined;

    if (!obj) {
      return false;
    }

    const code = obj.code?.trim();
    const content = obj.content?.trim();

    return Boolean(code || content);
  }

  defaultMessage() {
    return 'code 和 content 至少填写一项';
  }
}

export class CreateSmsDto {
  @IsString()
  companyId!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  code?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  content?: string;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @Validate(SmsCodeOrContentConstraint)
  private readonly _codeOrContentCheck?: undefined;
}
