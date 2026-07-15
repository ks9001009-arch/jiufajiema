import { ConflictException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { createUnsupportedProviderCapabilities } from '../provider-capabilities';
import { ProviderAdapterError } from '../provider-errors';
import type { ProviderAdapter } from '../provider-adapter.interface';
import type { NormalizedProviderEvent } from '../provider-types';
import { ProviderWebhookController } from './provider-webhook.controller';

describe('ProviderWebhookController', () => {
  const providerId = 'provider-1';
  const companyId = 'company-1';

  let resolveByProviderId: jest.Mock;
  let accept: jest.Mock;
  let controller: ProviderWebhookController;
  let adapter: ProviderAdapter & {
    verifyWebhook: jest.Mock;
    parseWebhook: jest.Mock;
  };

  function createAdapter(overrides: Partial<ProviderAdapter> = {}) {
    const capabilities = {
      ...createUnsupportedProviderCapabilities(),
      webhook: true,
    };

    return {
      code: 'test-adapter',
      getCapabilities: () => capabilities,
      validateConfig: () => ({ ok: true as const }),
      mapError: (error: unknown, operation: never) =>
        new ProviderAdapterError({
          code: 'TEST',
          category: 'UNKNOWN',
          operation,
          providerCode: 'test-adapter',
          retryable: false,
          safeMessage: 'test',
          cause: error instanceof Error ? error : undefined,
        }),
      verifyWebhook: jest.fn().mockResolvedValue(undefined),
      parseWebhook: jest.fn().mockResolvedValue([]),
      ...overrides,
    } as ProviderAdapter & {
      verifyWebhook: jest.Mock;
      parseWebhook: jest.Mock;
    };
  }

  function createRequest(rawBody?: Buffer): RawBodyRequest<Request> {
    return {
      rawBody,
      headers: { 'x-signature': 'sig' },
      query: { token: 'q' },
    } as unknown as RawBodyRequest<Request>;
  }

  beforeEach(() => {
    adapter = createAdapter();
    resolveByProviderId = jest.fn().mockResolvedValue({
      adapter,
      context: {
        companyId,
        providerId,
        adapterCode: 'test-adapter',
        config: null,
        actorUserId: null,
      },
    });
    accept = jest.fn().mockResolvedValue({
      outcome: 'completed',
      orderId: 'order-1',
    });
    controller = new ProviderWebhookController(
      { resolveByProviderId } as never,
      { accept } as never,
    );
  });

  it('throws WEBHOOK_UNSUPPORTED when capability is false', async () => {
    adapter = createAdapter({
      getCapabilities: () => createUnsupportedProviderCapabilities(),
      verifyWebhook: undefined,
      parseWebhook: undefined,
    } as never);
    resolveByProviderId.mockResolvedValue({
      adapter,
      context: {
        companyId,
        providerId,
        adapterCode: 'manual',
        config: null,
      },
    });

    try {
      await controller.handleWebhook(
        providerId,
        createRequest(Buffer.from('{}')),
        {},
        {},
      );
      fail('expected ProviderAdapterError');
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderAdapterError);
      expect((error as ProviderAdapterError).code).toBe('WEBHOOK_UNSUPPORTED');
      expect((error as ProviderAdapterError).category).toBe('UNSUPPORTED');
      expect((error as ProviderAdapterError).operation).toBe('VERIFY_WEBHOOK');
    }
  });

  it('throws WEBHOOK_METHOD_MISSING when verifyWebhook is absent', async () => {
    adapter = createAdapter({
      verifyWebhook: undefined,
    } as never);
    resolveByProviderId.mockResolvedValue({
      adapter,
      context: {
        companyId,
        providerId,
        adapterCode: 'test-adapter',
        config: null,
      },
    });

    await expect(
      controller.handleWebhook(
        providerId,
        createRequest(Buffer.from('{}')),
        {},
        {},
      ),
    ).rejects.toMatchObject({
      code: 'WEBHOOK_METHOD_MISSING',
      category: 'CONFIG',
      operation: 'VERIFY_WEBHOOK',
    });
  });

  it('throws WEBHOOK_METHOD_MISSING when parseWebhook is absent', async () => {
    adapter = createAdapter({
      parseWebhook: undefined,
    } as never);
    resolveByProviderId.mockResolvedValue({
      adapter,
      context: {
        companyId,
        providerId,
        adapterCode: 'test-adapter',
        config: null,
      },
    });

    await expect(
      controller.handleWebhook(
        providerId,
        createRequest(Buffer.from('{}')),
        {},
        {},
      ),
    ).rejects.toMatchObject({
      code: 'WEBHOOK_METHOD_MISSING',
      category: 'CONFIG',
      operation: 'PARSE_WEBHOOK',
    });
  });

  it('does not call parse/ingress when verifyWebhook fails', async () => {
    adapter.verifyWebhook.mockRejectedValue(
      new ProviderAdapterError({
        code: 'WEBHOOK_AUTH_FAILED',
        category: 'AUTH',
        operation: 'VERIFY_WEBHOOK',
        providerCode: 'test-adapter',
        retryable: false,
        safeMessage: 'invalid signature',
      }),
    );

    await expect(
      controller.handleWebhook(
        providerId,
        createRequest(Buffer.from('{}')),
        {},
        {},
      ),
    ).rejects.toMatchObject({ code: 'WEBHOOK_AUTH_FAILED' });

    expect(adapter.parseWebhook).not.toHaveBeenCalled();
    expect(accept).not.toHaveBeenCalled();
  });

  it('does not call ingress when parseWebhook fails', async () => {
    adapter.parseWebhook.mockRejectedValue(
      new ProviderAdapterError({
        code: 'WEBHOOK_PARSE_FAILED',
        category: 'INVALID_REQUEST',
        operation: 'PARSE_WEBHOOK',
        providerCode: 'test-adapter',
        retryable: false,
        safeMessage: 'invalid payload',
      }),
    );

    await expect(
      controller.handleWebhook(
        providerId,
        createRequest(Buffer.from('{}')),
        {},
        {},
      ),
    ).rejects.toMatchObject({ code: 'WEBHOOK_PARSE_FAILED' });

    expect(accept).not.toHaveBeenCalled();
  });

  it('completes SMS_RECEIVED events through ingress', async () => {
    const events: NormalizedProviderEvent[] = [
      {
        type: 'SMS_RECEIVED',
        occurredAt: new Date('2026-07-15T00:00:00.000Z'),
        orderId: 'order-1',
        sms: {
          orderId: 'order-1',
          code: '9999',
          receivedAt: new Date('2026-07-15T00:00:00.000Z'),
        },
      },
    ];
    adapter.parseWebhook.mockResolvedValue(events);

    const response = await controller.handleWebhook(
      providerId,
      createRequest(Buffer.from('{"ok":true}')),
      { 'x-signature': 'sig' },
      {},
    );

    expect(accept).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'webhook',
        companyId,
        providerId,
        orderId: 'order-1',
        code: '9999',
      }),
    );
    expect(response).toEqual({
      providerId,
      received: 1,
      completed: 1,
      ignored: 0,
      results: [
        {
          type: 'SMS_RECEIVED',
          orderId: 'order-1',
          outcome: 'completed',
        },
      ],
    });
  });

  it('ignores non-SMS_RECEIVED events', async () => {
    adapter.parseWebhook.mockResolvedValue([
      {
        type: 'ORDER_STATUS',
        occurredAt: new Date(),
        orderId: 'order-1',
      },
    ] satisfies NormalizedProviderEvent[]);

    const response = await controller.handleWebhook(
      providerId,
      createRequest(Buffer.from('{}')),
      {},
      {},
    );

    expect(accept).not.toHaveBeenCalled();
    expect(response.ignored).toBe(1);
    expect(response.results[0]?.outcome).toBe('ignored_unsupported_event');
  });

  it('ignores SMS_RECEIVED without orderId', async () => {
    adapter.parseWebhook.mockResolvedValue([
      {
        type: 'SMS_RECEIVED',
        occurredAt: new Date(),
        sms: {
          orderId: undefined as never,
          code: '1',
          receivedAt: new Date(),
        },
      },
    ]);

    const response = await controller.handleWebhook(
      providerId,
      createRequest(Buffer.from('{}')),
      {},
      {},
    );

    expect(accept).not.toHaveBeenCalled();
    expect(response.results[0]?.outcome).toBe('ignored_invalid_event');
  });

  it('aggregates multi-event outcomes and continues after ignored_terminal', async () => {
    adapter.parseWebhook.mockResolvedValue([
      {
        type: 'SMS_RECEIVED',
        occurredAt: new Date(),
        orderId: 'order-1',
        sms: {
          orderId: 'order-1',
          code: '1111',
          receivedAt: new Date(),
        },
      },
      {
        type: 'UNKNOWN',
        occurredAt: new Date(),
      },
      {
        type: 'SMS_RECEIVED',
        occurredAt: new Date(),
        orderId: 'order-2',
        sms: {
          orderId: 'order-2',
          code: '2222',
          receivedAt: new Date(),
        },
      },
    ] satisfies NormalizedProviderEvent[]);

    accept
      .mockResolvedValueOnce({
        outcome: 'ignored_terminal',
        orderId: 'order-1',
      })
      .mockResolvedValueOnce({
        outcome: 'completed',
        orderId: 'order-2',
      });

    const response = await controller.handleWebhook(
      providerId,
      createRequest(Buffer.from('{}')),
      {},
      {},
    );

    expect(response).toEqual({
      providerId,
      received: 3,
      completed: 1,
      ignored: 2,
      results: [
        {
          type: 'SMS_RECEIVED',
          orderId: 'order-1',
          outcome: 'ignored_terminal',
        },
        {
          type: 'UNKNOWN',
          outcome: 'ignored_unsupported_event',
        },
        {
          type: 'SMS_RECEIVED',
          orderId: 'order-2',
          outcome: 'completed',
        },
      ],
    });
  });

  it('fails the whole request on non-terminal ingress business errors', async () => {
    adapter.parseWebhook.mockResolvedValue([
      {
        type: 'SMS_RECEIVED',
        occurredAt: new Date(),
        orderId: 'order-1',
        sms: {
          orderId: 'order-1',
          code: '1',
          receivedAt: new Date(),
        },
      },
    ]);
    accept.mockRejectedValue(
      new ConflictException('Phone resource is not locked by this order'),
    );

    await expect(
      controller.handleWebhook(
        providerId,
        createRequest(Buffer.from('{}')),
        {},
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('ManualAdapter webhook=false cannot accept webhooks', async () => {
    adapter = createAdapter({
      code: 'manual',
      getCapabilities: () => createUnsupportedProviderCapabilities(),
      verifyWebhook: undefined,
      parseWebhook: undefined,
    } as never);
    resolveByProviderId.mockResolvedValue({
      adapter,
      context: {
        companyId,
        providerId,
        adapterCode: 'manual',
        config: null,
      },
    });

    await expect(
      controller.handleWebhook(
        providerId,
        createRequest(Buffer.from('{}')),
        {},
        {},
      ),
    ).rejects.toMatchObject({
      code: 'WEBHOOK_UNSUPPORTED',
    });
  });
});
