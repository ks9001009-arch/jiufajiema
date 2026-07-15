import { Module, forwardRef } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { ProviderAdaptersModule } from '../providers/adapters/adapters.module';
import { OrderTimeoutQueueService } from './order-timeout-queue.service';
import { OrderTimeoutScanService } from './order-timeout-scan.service';
import { ProviderPollingQueueService } from './provider-polling-queue.service';

@Module({
  imports: [forwardRef(() => OrdersModule), ProviderAdaptersModule],
  providers: [
    OrderTimeoutQueueService,
    OrderTimeoutScanService,
    ProviderPollingQueueService,
  ],
  exports: [
    OrderTimeoutQueueService,
    OrderTimeoutScanService,
    ProviderPollingQueueService,
  ],
})
export class JobsModule {}
