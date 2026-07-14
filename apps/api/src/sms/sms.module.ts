import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WalletsModule } from '../wallets/wallets.module';
import { OrderSmsController } from './order-sms.controller';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';

@Module({
  imports: [AuthModule, WalletsModule],
  controllers: [SmsController, OrderSmsController],
  providers: [SmsService],
})
export class SmsModule {}
