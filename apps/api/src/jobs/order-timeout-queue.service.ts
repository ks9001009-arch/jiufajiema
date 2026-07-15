import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { OrdersService } from '../orders/orders.service';
import { buildOrderTimeoutJobId } from '../orders/order-timeout.util';

export const ORDER_TIMEOUT_QUEUE_NAME = 'order-timeout';

type OrderTimeoutJobPayload = {
  orderId: string;
};

@Injectable()
export class OrderTimeoutQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderTimeoutQueueService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private connectionOptions: {
    url: string;
    maxRetriesPerRequest: null;
  } | null = null;

  constructor(
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
  ) {}

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL?.trim();

    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL is not configured; delayed order timeout jobs are disabled. Scan fallback remains active.',
      );
      return;
    }

    try {
      this.connectionOptions = {
        url: redisUrl,
        maxRetriesPerRequest: null,
      };

      this.queue = new Queue(ORDER_TIMEOUT_QUEUE_NAME, {
        connection: this.connectionOptions,
      });

      this.worker = new Worker(
        ORDER_TIMEOUT_QUEUE_NAME,
        async (job) => {
          await this.ordersService.timeoutOrder(job.data.orderId);
        },
        {
          connection: this.connectionOptions,
        },
      );

      this.worker.on('failed', (job, error) => {
        this.logger.error(
          `Order timeout job failed for order ${job?.data.orderId ?? 'unknown'}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
    } catch (error) {
      this.logger.warn(
        'Failed to initialize order timeout queue; scan fallback remains active.',
        error instanceof Error ? error.stack : String(error),
      );
      await this.closeQueueResources();
    }
  }

  async onModuleDestroy() {
    await this.closeQueueResources();
  }

  isQueueAvailable() {
    return this.queue !== null;
  }

  async scheduleOrderTimeout(orderId: string, expiresAt: Date) {
    if (!this.queue) {
      this.logger.warn(
        `Order timeout queue unavailable for order ${orderId}; scan fallback will handle expiration.`,
      );
      return;
    }

    const delay = Math.max(0, expiresAt.getTime() - Date.now());

    try {
      await this.queue.add(
        'timeout',
        { orderId },
        {
          jobId: buildOrderTimeoutJobId(orderId),
          delay,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to schedule order timeout job for order ${orderId}; scan fallback will handle expiration.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async closeQueueResources() {
    await this.worker?.close();
    await this.queue?.close();

    this.worker = null;
    this.queue = null;
    this.connectionOptions = null;
  }
}
