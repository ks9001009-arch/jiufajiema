import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { OrderStatus } from '../orders/dto/order.validation';
import { CreateSmsDto } from './dto/create-sms.dto';
import { ListSmsQueryDto } from './dto/list-sms-query.dto';
import type { SmsStatus } from './dto/sms.validation';
import { OrderSmsCompletionService } from './order-sms-completion.service';

type SmsFilters = {
  companyId?: string;
  orderId?: string;
  phone?: string;
  code?: string;
  status?: SmsStatus;
  orderStatus?: OrderStatus;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  pageSize?: number;
};

type SmsRecord = {
  id: string;
  orderId: string;
  code: string | null;
  content: string | null;
  status: string;
  receivedAt: Date | null;
  createdAt: Date;
};

const companySelect = {
  id: true,
  name: true,
  code: true,
} as const;

const serviceSelect = {
  id: true,
  companyId: true,
  name: true,
  code: true,
} as const;

const providerSelect = {
  id: true,
  companyId: true,
  name: true,
  code: true,
  status: true,
} as const;

const phoneResourceSelect = {
  id: true,
  companyId: true,
  providerId: true,
  phone: true,
  country: true,
  status: true,
} as const;

const orderSelect = {
  id: true,
  companyId: true,
  status: true,
  amount: true,
  company: { select: companySelect },
  service: { select: serviceSelect },
  provider: { select: providerSelect },
  phoneResource: { select: phoneResourceSelect },
} as const;

const smsSelect = {
  id: true,
  orderId: true,
  code: true,
  content: true,
  status: true,
  receivedAt: true,
  createdAt: true,
  order: { select: orderSelect },
} as const;

@Injectable()
export class SmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderSmsCompletionService: OrderSmsCompletionService,
  ) {}

  async findAll(query: ListSmsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildListWhere(query);

    const [items, total] = await Promise.all([
      this.prisma.sms.findMany({
        where,
        select: smsSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.sms.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async findOne(id: string) {
    const sms = await this.prisma.sms.findUnique({
      where: { id },
      select: smsSelect,
    });

    if (!sms) {
      throw new NotFoundException(`Sms with id "${id}" not found`);
    }

    return this.toResponse(sms);
  }

  async findByOrderId(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with id "${orderId}" not found`);
    }

    const items = await this.prisma.sms.findMany({
      where: { orderId },
      select: smsSelect,
      orderBy: { createdAt: 'desc' },
    });

    return items.map((item) => this.toResponse(item));
  }

  async createForOrder(
    orderId: string,
    dto: CreateSmsDto,
    actorUserId: string,
  ) {
    const result = await this.orderSmsCompletionService.completeForOrder({
      orderId,
      companyId: dto.companyId,
      code: dto.code,
      content: dto.content,
      receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : undefined,
      actorUserId,
      source: 'manual',
    });

    return this.toResponse(result);
  }

  private buildListWhere(filters: SmsFilters) {
    const createdAt =
      filters.createdFrom || filters.createdTo
        ? {
            ...(filters.createdFrom
              ? { gte: new Date(filters.createdFrom) }
              : {}),
            ...(filters.createdTo ? { lte: new Date(filters.createdTo) } : {}),
          }
        : undefined;

    const orderFilter = {
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.orderStatus ? { status: filters.orderStatus } : {}),
      ...(filters.phone
        ? {
            phoneResource: {
              phone: { contains: filters.phone.trim() },
            },
          }
        : {}),
    };

    const hasOrderFilter = Object.keys(orderFilter).length > 0;

    return {
      ...(filters.orderId ? { orderId: filters.orderId } : {}),
      ...(filters.code ? { code: { contains: filters.code.trim() } } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(hasOrderFilter ? { order: orderFilter } : {}),
    };
  }

  private toResponse<T extends SmsRecord & { order?: unknown }>(sms: T) {
    return {
      ...sms,
      receivedAt: sms.receivedAt?.toISOString() ?? null,
      createdAt: sms.createdAt.toISOString(),
    };
  }
}
