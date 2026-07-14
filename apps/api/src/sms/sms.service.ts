import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  TERMINAL_ORDER_STATUSES,
  type OrderStatus,
} from '../orders/dto/order.validation';
import {
  buildOrderWalletIdempotencyKey,
  getOrderCurrency,
} from '../wallets/order-currency.util';
import { WalletLedgerService } from '../wallets/wallet-ledger.service';
import { walletAmountToString } from '../wallets/wallet-decimal.util';
import { CreateSmsDto } from './dto/create-sms.dto';
import { ListSmsQueryDto } from './dto/list-sms-query.dto';
import type { SmsStatus } from './dto/sms.validation';

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

const terminalStatusSet = new Set<string>(TERMINAL_ORDER_STATUSES);

@Injectable()
export class SmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletLedgerService: WalletLedgerService,
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
    const existing = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        companyId: true,
        status: true,
        phoneResourceId: true,
        amount: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Order with id "${orderId}" not found`);
    }

    if (existing.companyId !== dto.companyId) {
      throw new BadRequestException('Order must belong to the request company');
    }

    if (terminalStatusSet.has(existing.status)) {
      throw new ConflictException('Order is already in a terminal status');
    }

    if (existing.status !== 'WAIT_SMS') {
      throw new BadRequestException(
        'Only orders in WAIT_SMS status can receive sms',
      );
    }

    const code = dto.code?.trim() || null;
    const content = dto.content?.trim() || null;

    if (!code && !content) {
      throw new BadRequestException('code 和 content 至少填写一项');
    }

    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();
    const orderAmount = walletAmountToString(existing.amount);
    const orderCurrency = getOrderCurrency();

    const result = await this.prisma.$transaction(async (tx) => {
      const walletAccount = await this.walletLedgerService.resolveCompanyWallet(
        tx,
        existing.companyId,
        orderCurrency,
      );

      await this.walletLedgerService.capture({
        tx,
        walletAccountId: walletAccount.id,
        amount: orderAmount,
        idempotencyKey: buildOrderWalletIdempotencyKey(orderId, 'capture'),
        actorUserId,
        referenceType: 'Order',
        referenceId: orderId,
        remark: 'Order sms success capture',
      });

      const phoneUpdate = await tx.phoneResource.updateMany({
        where: {
          id: existing.phoneResourceId,
          status: 'LOCKED',
        },
        data: {
          status: 'USED',
        },
      });

      if (phoneUpdate.count !== 1) {
        throw new ConflictException(
          'Phone resource is not locked by this order',
        );
      }

      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'SUCCESS',
        },
        select: orderSelect,
      });

      const sms = await tx.sms.create({
        data: {
          orderId,
          code,
          content,
          status: 'RECEIVED',
          receivedAt,
        },
        select: smsSelect,
      });

      await tx.auditLog.create({
        data: {
          action: 'sms.create',
          targetType: 'Sms',
          targetId: sms.id,
          actorUserId,
          companyId: order.companyId,
          afterData: this.toAuditSmsData(sms),
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'order.status',
          targetType: 'Order',
          targetId: order.id,
          actorUserId,
          companyId: order.companyId,
          beforeData: { status: existing.status },
          afterData: { status: order.status },
        },
      });

      return sms;
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

  private toAuditSmsData(sms: SmsRecord) {
    return {
      id: sms.id,
      orderId: sms.orderId,
      code: sms.code,
      content: sms.content,
      status: sms.status,
      receivedAt: sms.receivedAt?.toISOString() ?? null,
      createdAt: sms.createdAt.toISOString(),
    };
  }
}
