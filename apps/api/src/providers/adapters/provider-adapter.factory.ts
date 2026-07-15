import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { ProviderAdapter } from './provider-adapter.interface';
import { ProviderAdapterRegistry } from './provider-adapter.registry';
import { ProviderAdapterError } from './provider-errors';
import type { ProviderContext } from './provider-types';

export type ResolveProviderAdapterInput = {
  providerId: string;
  companyId: string;
  actorUserId?: string | null;
};

export interface AdapterResolution {
  adapter: ProviderAdapter;
  context: ProviderContext;
}

@Injectable()
export class ProviderAdapterFactory {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderAdapterRegistry,
  ) {}

  async resolve(
    input: ResolveProviderAdapterInput,
  ): Promise<AdapterResolution> {
    return this.resolveFromDatabase({
      providerId: input.providerId,
      expectedCompanyId: input.companyId,
      actorUserId: input.actorUserId,
    });
  }

  /**
   * Resolve adapter using only providerId.
   * companyId is always loaded from the database (never from the client).
   */
  async resolveByProviderId(
    providerId: string,
    actorUserId?: string | null,
  ): Promise<AdapterResolution> {
    return this.resolveFromDatabase({
      providerId,
      actorUserId,
    });
  }

  private async resolveFromDatabase(input: {
    providerId: string;
    expectedCompanyId?: string;
    actorUserId?: string | null;
  }): Promise<AdapterResolution> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: input.providerId },
      select: {
        id: true,
        companyId: true,
        adapter: true,
        config: true,
        status: true,
      },
    });

    if (!provider) {
      throw new ProviderAdapterError({
        code: 'ADAPTER_PROVIDER_NOT_FOUND',
        category: 'NOT_FOUND',
        operation: 'RESOLVE_ADAPTER',
        providerCode: 'UNKNOWN',
        retryable: false,
        safeMessage: 'Provider was not found',
      });
    }

    if (
      input.expectedCompanyId !== undefined &&
      provider.companyId !== input.expectedCompanyId
    ) {
      throw new ProviderAdapterError({
        code: 'PROVIDER_COMPANY_MISMATCH',
        category: 'INVALID_REQUEST',
        operation: 'RESOLVE_ADAPTER',
        providerCode: provider.adapter,
        retryable: false,
        safeMessage: 'Provider does not belong to the requested company',
      });
    }

    if (provider.status !== 'ACTIVE') {
      throw new ProviderAdapterError({
        code: 'PROVIDER_DISABLED',
        category: 'CONFIG',
        operation: 'RESOLVE_ADAPTER',
        providerCode: provider.adapter,
        retryable: false,
        safeMessage: 'Provider is disabled',
      });
    }

    const adapter = this.registry.get(provider.adapter);
    const validation = adapter.validateConfig(provider.config);

    if (!validation.ok) {
      throw new ProviderAdapterError({
        code: 'PROVIDER_CONFIG_INVALID',
        category: 'CONFIG',
        operation: 'VALIDATE_CONFIG',
        providerCode: provider.adapter,
        retryable: false,
        safeMessage: 'Provider configuration is invalid',
        internalMessage: validation.errors.join('; '),
      });
    }

    return {
      adapter,
      context: {
        companyId: provider.companyId,
        providerId: provider.id,
        adapterCode: provider.adapter,
        config: provider.config,
        actorUserId: input.actorUserId,
      },
    };
  }
}
