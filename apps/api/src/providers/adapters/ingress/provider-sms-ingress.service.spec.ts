import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrderTerminalStateConflictException } from '../../../sms/order-terminal-state-conflict.exception';
import { ProviderSmsIngressService } from './provider-sms-ingress.service';

describe('ProviderSmsIngressService', () => {
  const orderId = 'order-1';
  const companyId = 'company-1';
  const providerId = 'provider-1';

  let completeForOrder: jest.Mock;
  let service: ProviderSmsIngressService;

  beforeEach(() => {
    completeForOrder = jest.fn().mockResolvedValue({ id: 'sms-1' });
    service = new ProviderSmsIngressService({
      completeForOrder,
    } as never);
  });

  async function accept(overrides: Record<string, unknown> = {}) {
    return service.accept({
      source: 'webhook',
      companyId,
      providerId,
      orderId,
      code: '1234',
      content: null,
      receivedAt: new Date('2026-07-15T00:00:00.000Z'),
      ...overrides,
    });
  }

  it('completes SMS_RECEIVED via OrderSmsCompletionService with source webhook', async () => {
    const result = await accept();

    expect(result).toEqual({ outcome: 'completed', orderId });
    expect(completeForOrder).toHaveBeenCalledWith({
      orderId,
      companyId,
      providerId,
      code: '1234',
      content: null,
      receivedAt: new Date('2026-07-15T00:00:00.000Z'),
      actorUserId: null,
      source: 'webhook',
    });
  });

  it('maps SUCCESS terminal conflict to ignored_terminal by exception type', async () => {
    completeForOrder.mockRejectedValue(
      new OrderTerminalStateConflictException('SUCCESS'),
    );

    await expect(accept()).resolves.toEqual({
      outcome: 'ignored_terminal',
      orderId,
    });
  });

  it('maps CANCELLED terminal conflict to ignored_terminal by exception type', async () => {
    completeForOrder.mockRejectedValue(
      new OrderTerminalStateConflictException('CANCELLED'),
    );

    await expect(accept()).resolves.toEqual({
      outcome: 'ignored_terminal',
      orderId,
    });
  });

  it('does not swallow non-terminal Conflict', async () => {
    completeForOrder.mockRejectedValue(
      new ConflictException('Phone resource is not locked by this order'),
    );

    await expect(accept()).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects empty providerId before completion', async () => {
    await expect(accept({ providerId: '  ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(completeForOrder).not.toHaveBeenCalled();
  });

  it('rejects empty code and content before completion', async () => {
    await expect(accept({ code: '  ', content: null })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(completeForOrder).not.toHaveBeenCalled();
  });

  it('propagates provider mismatch from completion', async () => {
    completeForOrder.mockRejectedValue(
      new BadRequestException('Order must belong to the selected provider'),
    );

    await expect(accept()).rejects.toBeInstanceOf(BadRequestException);
  });

  it('propagates NotFoundException from completion', async () => {
    completeForOrder.mockRejectedValue(
      new NotFoundException(`Order with id "${orderId}" not found`),
    );

    await expect(accept()).rejects.toBeInstanceOf(NotFoundException);
  });
});
