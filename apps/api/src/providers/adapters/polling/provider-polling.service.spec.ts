import { ConflictException } from '@nestjs/common';
import { createUnsupportedProviderCapabilities } from '../provider-capabilities';
import { ProviderAdapterError } from '../provider-errors';
import type { ProviderAdapter } from '../provider-adapter.interface';
import type { NormalizedProviderSms } from '../provider-types';
import { ProviderPollingService } from './provider-polling.service';

describe('ProviderPollingService', () => {
  const providerId = 'provider-1';
  const companyId = 'company-1';

  let resolveByProviderId: jest.Mock;
  let accept: jest.Mock;
  let service: ProviderPollingService;
  let adapter: ProviderAdapter & { pollMessages: jest.Mock };

  function createAdapter(overrides: Partial<ProviderAdapter> = {}) {
    const capabilities = {
      ...createUnsupportedProviderCapabilities(),
      pollMessages: true,
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
      pollMessages: jest.fn().mockResolvedValue([]),
      ...overrides,
    } as ProviderAdapter & { pollMessages: jest.Mock };
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
    service = new ProviderPollingService(
      { resolveByProviderId } as never,
      { accept } as never,
    );
  });

  it('throws POLLING_UNSUPPORTED when capability is false', async () => {
    adapter = createAdapter({
      getCapabilities: () => createUnsupportedProviderCapabilities(),
      pollMessages: undefined,
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

    await expect(service.poll({ providerId })).rejects.toMatchObject({
      code: 'POLLING_UNSUPPORTED',
      category: 'UNSUPPORTED',
      operation: 'POLL_MESSAGES',
      retryable: false,
    });
    expect(accept).not.toHaveBeenCalled();
  });

  it('throws POLLING_METHOD_MISSING when pollMessages is absent', async () => {
    adapter = createAdapter({
      pollMessages: undefined,
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

    await expect(service.poll({ providerId })).rejects.toMatchObject({
      code: 'POLLING_METHOD_MISSING',
      category: 'CONFIG',
      retryable: false,
    });
  });

  it('does not call ingress when pollMessages throws', async () => {
    adapter.pollMessages.mockRejectedValue(
      new ProviderAdapterError({
        code: 'UPSTREAM_TIMEOUT',
        category: 'TIMEOUT',
        operation: 'POLL_MESSAGES',
        providerCode: 'test-adapter',
        retryable: true,
        safeMessage: 'upstream timeout',
      }),
    );

    await expect(service.poll({ providerId })).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
    });
    expect(accept).not.toHaveBeenCalled();
  });

  it('completes valid SMS through ingress with source polling', async () => {
    const messages: NormalizedProviderSms[] = [
      {
        orderId: 'order-1',
        code: '1234',
        receivedAt: new Date('2026-07-15T00:00:00.000Z'),
        providerMessageId: 'msg-1',
      },
    ];
    adapter.pollMessages.mockResolvedValue(messages);

    const result = await service.poll({ providerId, orderId: 'order-1' });

    expect(accept).toHaveBeenCalledWith({
      source: 'polling',
      companyId,
      providerId,
      orderId: 'order-1',
      code: '1234',
      content: null,
      receivedAt: messages[0]!.receivedAt,
      providerMessageId: 'msg-1',
    });
    expect(result).toEqual({
      providerId,
      received: 1,
      completed: 1,
      ignored: 0,
      results: [
        {
          orderId: 'order-1',
          providerMessageId: 'msg-1',
          outcome: 'completed',
        },
      ],
    });
  });

  it('maps ignored_terminal and continues', async () => {
    adapter.pollMessages.mockResolvedValue([
      {
        orderId: 'order-1',
        code: '1',
        receivedAt: new Date(),
      },
      {
        orderId: 'order-2',
        code: '2',
        receivedAt: new Date(),
      },
    ] satisfies NormalizedProviderSms[]);

    accept
      .mockResolvedValueOnce({
        outcome: 'ignored_terminal',
        orderId: 'order-1',
      })
      .mockResolvedValueOnce({
        outcome: 'completed',
        orderId: 'order-2',
      });

    const result = await service.poll({ providerId });

    expect(result.completed).toBe(1);
    expect(result.ignored).toBe(1);
    expect(result.results[0]?.outcome).toBe('ignored_terminal');
    expect(result.results[1]?.outcome).toBe('completed');
  });

  it('ignores messages without orderId', async () => {
    adapter.pollMessages.mockResolvedValue([
      {
        orderId: '  ',
        code: '1',
        receivedAt: new Date(),
      },
    ]);

    const result = await service.poll({ providerId });

    expect(accept).not.toHaveBeenCalled();
    expect(result.results[0]?.outcome).toBe('ignored_invalid_message');
  });

  it('ignores messages with invalid receivedAt', async () => {
    adapter.pollMessages.mockResolvedValue([
      {
        orderId: 'order-1',
        code: '1',
        receivedAt: new Date('invalid'),
      },
    ]);

    const result = await service.poll({ providerId });

    expect(accept).not.toHaveBeenCalled();
    expect(result.results[0]?.outcome).toBe('ignored_invalid_message');
  });

  it('ignores messages with empty code and content', async () => {
    adapter.pollMessages.mockResolvedValue([
      {
        orderId: 'order-1',
        code: '  ',
        content: null,
        receivedAt: new Date(),
      },
    ]);

    const result = await service.poll({ providerId });

    expect(accept).not.toHaveBeenCalled();
    expect(result.results[0]?.outcome).toBe('ignored_invalid_message');
  });

  it('aggregates multi-message results', async () => {
    adapter.pollMessages.mockResolvedValue([
      {
        orderId: 'order-1',
        code: '1',
        receivedAt: new Date(),
      },
      {
        orderId: '',
        code: '2',
        receivedAt: new Date(),
      },
      {
        orderId: 'order-3',
        code: '3',
        receivedAt: new Date(),
      },
    ]);
    accept
      .mockResolvedValueOnce({
        outcome: 'completed',
        orderId: 'order-1',
      })
      .mockResolvedValueOnce({
        outcome: 'completed',
        orderId: 'order-3',
      });

    const result = await service.poll({ providerId });

    expect(result).toEqual({
      providerId,
      received: 3,
      completed: 2,
      ignored: 1,
      results: [
        { orderId: 'order-1', outcome: 'completed' },
        { outcome: 'ignored_invalid_message' },
        { orderId: 'order-3', outcome: 'completed' },
      ],
    });
  });

  it('fails the whole poll on non-idempotent ingress errors', async () => {
    adapter.pollMessages.mockResolvedValue([
      {
        orderId: 'order-1',
        code: '1',
        receivedAt: new Date(),
      },
    ]);
    accept.mockRejectedValue(
      new ConflictException('Phone resource is not locked by this order'),
    );

    await expect(service.poll({ providerId })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('loads companyId from adapter resolve and never trusts client companyId', async () => {
    adapter.pollMessages.mockResolvedValue([
      {
        orderId: 'order-1',
        code: '1',
        receivedAt: new Date(),
      },
    ]);

    await service.poll({
      providerId,
      // @ts-expect-error client must not supply companyId
      companyId: 'malicious-company',
    });

    expect(resolveByProviderId).toHaveBeenCalledWith(providerId);
    expect(accept).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId,
        source: 'polling',
      }),
    );
  });
});
