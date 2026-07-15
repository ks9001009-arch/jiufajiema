import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { buildOrderWalletIdempotencyKey } from '../wallets/order-currency.util';
import { OrderSmsCompletionService } from './order-sms-completion.service';
import { OrderTerminalStateConflictException } from './order-terminal-state-conflict.exception';

describe('OrderSmsCompletionService', () => {
  const orderId = 'order-1';
  const companyId = 'company-1';
  const phoneResourceId = 'phone-1';
  const walletAccountId = 'wallet-1';
  const actorUserId = 'user-1';

  let capture: jest.Mock;
  let resolveCompanyWallet: jest.Mock;
  let queryRaw: jest.Mock;
  let orderFindUnique: jest.Mock;
  let phoneUpdateMany: jest.Mock;
  let orderUpdate: jest.Mock;
  let smsCreate: jest.Mock;
  let auditLogCreate: jest.Mock;
  let service: OrderSmsCompletionService;
  let lockedOrderStatus: string;

  beforeEach(() => {
    lockedOrderStatus = 'WAIT_SMS';
    capture = jest.fn().mockResolvedValue({ idempotent: false });
    resolveCompanyWallet = jest.fn().mockResolvedValue({ id: walletAccountId });
    queryRaw = jest.fn().mockResolvedValue([{ id: orderId }]);
    orderFindUnique = jest.fn().mockImplementation(async () => ({
      id: orderId,
      companyId,
      providerId: 'provider-1',
      status: lockedOrderStatus,
      phoneResourceId,
      amount: '1.0000',
    }));
    phoneUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    orderUpdate = jest.fn().mockResolvedValue({
      id: orderId,
      companyId,
      status: 'SUCCESS',
      amount: '1.0000',
      company: { id: companyId, name: 'C', code: 'c' },
      service: { id: 'svc', companyId, name: 'S', code: 's' },
      provider: {
        id: 'prov',
        companyId,
        name: 'P',
        code: 'p',
        status: 'ACTIVE',
      },
      phoneResource: {
        id: phoneResourceId,
        companyId,
        providerId: 'prov',
        phone: '100',
        country: 'US',
        status: 'USED',
      },
    });
    smsCreate = jest.fn().mockResolvedValue({
      id: 'sms-1',
      orderId,
      code: '1234',
      content: null,
      status: 'RECEIVED',
      receivedAt: new Date('2026-07-15T00:00:00.000Z'),
      createdAt: new Date('2026-07-15T00:00:00.000Z'),
      order: {},
    });
    auditLogCreate = jest.fn().mockResolvedValue({});

    const tx = {
      $queryRaw: queryRaw,
      order: {
        findUnique: orderFindUnique,
        update: orderUpdate,
      },
      phoneResource: {
        updateMany: phoneUpdateMany,
      },
      sms: {
        create: smsCreate,
      },
      auditLog: {
        create: auditLogCreate,
      },
    };

    const prisma = {
      $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) =>
        fn(tx),
      ),
    };

    service = new OrderSmsCompletionService(
      prisma as never,
      {
        capture,
        resolveCompanyWallet,
      } as never,
    );
  });

  async function complete(overrides: Record<string, unknown> = {}) {
    return service.completeForOrder({
      orderId,
      companyId,
      code: '1234',
      content: null,
      actorUserId,
      source: 'manual',
      ...overrides,
    });
  }

  it('completes WAIT_SMS order: capture, USED, SUCCESS, Sms, AuditLog', async () => {
    const sms = await complete();

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        walletAccountId,
        amount: '1.0000',
        idempotencyKey: buildOrderWalletIdempotencyKey(orderId, 'capture'),
        actorUserId,
        referenceType: 'Order',
        referenceId: orderId,
        remark: 'Order sms success capture',
      }),
    );
    expect(phoneUpdateMany).toHaveBeenCalledWith({
      where: { id: phoneResourceId, status: 'LOCKED' },
      data: { status: 'USED' },
    });
    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: orderId },
        data: { status: 'SUCCESS' },
      }),
    );
    expect(smsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId,
          code: '1234',
          content: null,
          status: 'RECEIVED',
        }),
      }),
    );
    expect(auditLogCreate).toHaveBeenCalledTimes(2);
    expect(auditLogCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ action: 'sms.create' }),
      }),
    );
    expect(auditLogCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'order.status',
          beforeData: { status: 'WAIT_SMS' },
          afterData: { status: 'SUCCESS' },
        }),
      }),
    );
    expect(sms.id).toBe('sms-1');
  });

  it('rejects when code and content are both empty', async () => {
    await expect(
      complete({ code: '  ', content: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(capture).not.toHaveBeenCalled();
  });

  it('rejects when order is missing after lock', async () => {
    orderFindUnique.mockResolvedValue(null);

    await expect(complete()).rejects.toBeInstanceOf(NotFoundException);
    expect(capture).not.toHaveBeenCalled();
  });

  it('rejects company mismatch after lock', async () => {
    await expect(
      complete({ companyId: 'other-company' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(capture).not.toHaveBeenCalled();
  });

  it('rejects SUCCESS (terminal) after lock without capture', async () => {
    lockedOrderStatus = 'SUCCESS';

    await expect(complete()).rejects.toBeInstanceOf(
      OrderTerminalStateConflictException,
    );
    expect(capture).not.toHaveBeenCalled();
    expect(smsCreate).not.toHaveBeenCalled();
  });

  it('rejects CANCELLED after lock (timeout-first semantics)', async () => {
    lockedOrderStatus = 'CANCELLED';

    await expect(complete()).rejects.toBeInstanceOf(
      OrderTerminalStateConflictException,
    );
    expect(capture).not.toHaveBeenCalled();
  });

  it('rejects non-WAIT_SMS non-terminal after lock', async () => {
    lockedOrderStatus = 'PENDING';

    await expect(complete()).rejects.toBeInstanceOf(BadRequestException);
    expect(capture).not.toHaveBeenCalled();
  });

  it('second completion after SUCCESS does not capture again', async () => {
    await complete();
    expect(capture).toHaveBeenCalledTimes(1);

    lockedOrderStatus = 'SUCCESS';
    await expect(complete({ code: '9999' })).rejects.toBeInstanceOf(
      OrderTerminalStateConflictException,
    );
    expect(capture).toHaveBeenCalledTimes(1);
    expect(smsCreate).toHaveBeenCalledTimes(1);
  });

  it('rejects providerId mismatch after lock', async () => {
    await expect(
      complete({ providerId: 'other-provider' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(capture).not.toHaveBeenCalled();
  });
});
