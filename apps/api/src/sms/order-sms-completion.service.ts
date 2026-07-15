import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TERMINAL_ORDER_STATUSES } from '../orders/dto/order.validation';
import {
  buildOrderWalletIdempotencyKey,
  getOrderCurrency,
} from '../wallets/order-currency.util';
import { walletAmountToString } from '../wallets/wallet-decimal.util';
import { WalletLedgerService } from '../wallets/wallet-ledger.service';

export type OrderSmsCompletionSource = 'manual';

export type CompleteOrderSmsInput = {
  orderId: string;
  companyId: string;
  code?: string | null;
  content?: string | null;
  receivedAt?: Date;
  actorUserId?: string | null;
  source: OrderSmsCompletionSource;
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

/**
 * Unified domain entry for “SMS received → order SUCCESS”.
 * Completes wallet capture, phone USED, order SUCCESS, Sms + AuditLog in one TX.
 */
@Injectable()
export class OrderSmsCompletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletLedgerService: WalletLedgerService,
  ) {}

  async completeForOrder(input: CompleteOrderSmsInput) {
    const code = input.code?.trim() || null;
    const content = input.content?.trim() || null;

    if (!code && !content) {
      throw new BadRequestException('code 和 content 至少填写一项');
    }

    const receivedAt = input.receivedAt ?? new Date();
    const orderCurrency = getOrderCurrency();
    const actorUserId = input.actorUserId ?? null;

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "Order"
        WHERE "id" = ${input.orderId}
        FOR UPDATE
      `;

      const existing = await tx.order.findUnique({
        where: { id: input.orderId },
        select: {
          id: true,
          companyId: true,
          status: true,
          phoneResourceId: true,
          amount: true,
        },
      });

      if (!existing) {
        throw new NotFoundException(
          `Order with id "${input.orderId}" not found`,
        );
      }

      if (existing.companyId !== input.companyId) {
        throw new BadRequestException(
          'Order must belong to the request company',
        );
      }

      if (terminalStatusSet.has(existing.status)) {
        throw new ConflictException('Order is already in a terminal status');
      }

      if (existing.status !== 'WAIT_SMS') {
        throw new BadRequestException(
          'Only orders in WAIT_SMS status can receive sms',
        );
      }

      const orderAmount = walletAmountToString(existing.amount);

      const walletAccount = await this.walletLedgerService.resolveCompanyWallet(
        tx,
        existing.companyId,
        orderCurrency,
      );

      await this.walletLedgerService.capture({
        tx,
        walletAccountId: walletAccount.id,
        amount: orderAmount,
        idempotencyKey: buildOrderWalletIdempotencyKey(
          input.orderId,
          'capture',
        ),
        actorUserId,
        referenceType: 'Order',
        referenceId: input.orderId,
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
        where: { id: input.orderId },
        data: {
          status: 'SUCCESS',
        },
        select: orderSelect,
      });

      const sms = await tx.sms.create({
        data: {
          orderId: input.orderId,
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
