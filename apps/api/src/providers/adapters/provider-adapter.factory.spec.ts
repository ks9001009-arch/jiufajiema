import { ProviderAdapterError } from './provider-errors';
import { ProviderAdapterFactory } from './provider-adapter.factory';
import { ProviderAdapterRegistry } from './provider-adapter.registry';
import { ManualAdapter } from './manual/manual.adapter';
import { MANUAL_PROVIDER_ADAPTER_CODE } from './manual/manual.adapter.constants';
import type { PrismaService } from '../../database/prisma.service';

describe('ProviderAdapterFactory', () => {
  const providerId = 'provider-1';
  const companyId = 'company-1';

  let registry: ProviderAdapterRegistry;
  let manualAdapter: ManualAdapter;
  let findUnique: jest.Mock;
  let factory: ProviderAdapterFactory;

  beforeEach(() => {
    registry = new ProviderAdapterRegistry();
    manualAdapter = new ManualAdapter();
    registry.register(manualAdapter);

    findUnique = jest.fn();
    const prisma = {
      provider: { findUnique },
    } as unknown as PrismaService;

    factory = new ProviderAdapterFactory(prisma, registry);
  });

  it('throws ADAPTER_PROVIDER_NOT_FOUND when provider is missing', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      factory.resolve({ providerId, companyId }),
    ).rejects.toMatchObject({
      code: 'ADAPTER_PROVIDER_NOT_FOUND',
      category: 'NOT_FOUND',
      operation: 'RESOLVE_ADAPTER',
      retryable: false,
    });
  });

  it('throws PROVIDER_COMPANY_MISMATCH when company differs', async () => {
    findUnique.mockResolvedValue({
      id: providerId,
      companyId: 'other-company',
      adapter: MANUAL_PROVIDER_ADAPTER_CODE,
      config: null,
      status: 'ACTIVE',
    });

    await expect(
      factory.resolve({ providerId, companyId }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_COMPANY_MISMATCH',
      category: 'INVALID_REQUEST',
      retryable: false,
    });
  });

  it('throws PROVIDER_DISABLED when provider is not ACTIVE', async () => {
    findUnique.mockResolvedValue({
      id: providerId,
      companyId,
      adapter: MANUAL_PROVIDER_ADAPTER_CODE,
      config: null,
      status: 'DISABLED',
    });

    await expect(
      factory.resolve({ providerId, companyId }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_DISABLED',
      category: 'CONFIG',
      retryable: false,
    });
  });

  it('throws ADAPTER_NOT_FOUND when adapter code is unregistered', async () => {
    findUnique.mockResolvedValue({
      id: providerId,
      companyId,
      adapter: 'missing-adapter',
      config: null,
      status: 'ACTIVE',
    });

    await expect(
      factory.resolve({ providerId, companyId }),
    ).rejects.toMatchObject({
      code: 'ADAPTER_NOT_FOUND',
      category: 'CONFIG',
      providerCode: 'missing-adapter',
    });
  });

  it('throws PROVIDER_CONFIG_INVALID when config fails validation', async () => {
    findUnique.mockResolvedValue({
      id: providerId,
      companyId,
      adapter: MANUAL_PROVIDER_ADAPTER_CODE,
      config: { token: 'secret' },
      status: 'ACTIVE',
    });

    try {
      await factory.resolve({ providerId, companyId });
      fail('expected ProviderAdapterError');
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderAdapterError);
      expect((error as ProviderAdapterError).code).toBe(
        'PROVIDER_CONFIG_INVALID',
      );
      expect((error as ProviderAdapterError).operation).toBe('VALIDATE_CONFIG');
      expect((error as ProviderAdapterError).safeMessage).not.toContain(
        'secret',
      );
      expect((error as ProviderAdapterError).safeMessage).not.toContain(
        'token',
      );
    }
  });

  it('returns adapter and context on success', async () => {
    findUnique.mockResolvedValue({
      id: providerId,
      companyId,
      adapter: MANUAL_PROVIDER_ADAPTER_CODE,
      config: {},
      status: 'ACTIVE',
    });

    const resolution = await factory.resolve({
      providerId,
      companyId,
      actorUserId: 'user-1',
    });

    expect(resolution.adapter).toBe(manualAdapter);
    expect(resolution.context).toEqual({
      companyId,
      providerId,
      adapterCode: MANUAL_PROVIDER_ADAPTER_CODE,
      config: {},
      actorUserId: 'user-1',
    });
  });
});
