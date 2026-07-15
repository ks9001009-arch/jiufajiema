import { Module, forwardRef } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { OrderTimeoutQueueService } from './order-timeout-queue.service';
import { OrderTimeoutScanService } from './order-timeout-scan.service';

@Module({
  imports: [forwardRef(() => OrdersModule)],
  providers: [OrderTimeoutQueueService, OrderTimeoutScanService],
  exports: [OrderTimeoutQueueService, OrderTimeoutScanService],
})
export class JobsModule {}
