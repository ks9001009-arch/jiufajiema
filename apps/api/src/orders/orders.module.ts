import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CountryAccessModule } from '../country-access/country-access.module';
import { WalletsModule } from '../wallets/wallets.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule, CountryAccessModule, WalletsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
