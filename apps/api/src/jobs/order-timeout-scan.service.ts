import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OrdersService } from '../orders/orders.service';

const SCAN_INTERVAL_MS = 60_000;
const SCAN_BATCH_SIZE = 100;

@Injectable()
export class OrderTimeoutScanService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderTimeoutScanService.name);
  private scanTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
  ) {}

  async onModuleInit() {
    await this.scanExpiredOrders('startup');

    this.scanTimer = setInterval(() => {
      void this.scanExpiredOrders('interval');
    }, SCAN_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
  }

  async scanExpiredOrders(source: 'startup' | 'interval' | 'manual') {
    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: 'WAIT_SMS',
        expiresAt: {
          lte: new Date(),
        },
      },
      select: { id: true },
      orderBy: { expiresAt: 'asc' },
      take: SCAN_BATCH_SIZE,
    });

    if (expiredOrders.length === 0) {
      return { scanned: 0, handled: 0, source };
    }

    let handled = 0;

    for (const order of expiredOrders) {
      try {
        const result = await this.ordersService.timeoutOrder(order.id);

        if (result.handled) {
          handled += 1;
        }
      } catch (error) {
        this.logger.error(
          `Failed to timeout order ${order.id} during ${source} scan`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    this.logger.log(
      `Order timeout ${source} scan processed ${handled}/${expiredOrders.length} expired orders`,
    );

    return { scanned: expiredOrders.length, handled, source };
  }
}
