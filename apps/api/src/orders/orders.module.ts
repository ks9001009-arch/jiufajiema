import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CountryAccessModule } from '../country-access/country-access.module';
import { JobsModule } from '../jobs/jobs.module';
import { WalletsModule } from '../wallets/wallets.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    AuthModule,
    CountryAccessModule,
    WalletsModule,
    forwardRef(() => JobsModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
