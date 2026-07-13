import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrderSmsController } from './order-sms.controller';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';

@Module({
  imports: [AuthModule],
  controllers: [SmsController, OrderSmsController],
  providers: [SmsService],
})
export class SmsModule {}
