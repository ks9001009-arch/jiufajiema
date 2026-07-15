import { Injectable } from '@nestjs/common';
import type { ProviderAdapter } from './provider-adapter.interface';
import { ProviderAdapterError } from './provider-errors';
import type { ProviderAdapterCode } from './provider-types';

@Injectable()
export class ProviderAdapterRegistry {
  private readonly adapters = new Map<ProviderAdapterCode, ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    const code = adapter.code;

    if (
      typeof code !== 'string' ||
      code.length === 0 ||
      code.trim().length === 0
    ) {
      throw new ProviderAdapterError({
        code: 'ADAPTER_CODE_INVALID',
        category: 'CONFIG',
        operation: 'RESOLVE_ADAPTER',
        providerCode: 'UNKNOWN',
        retryable: false,
        safeMessage: 'Provider adapter code is invalid',
        internalMessage:
          'Adapter code must be a non-empty, non-whitespace string',
      });
    }

    if (this.adapters.has(code)) {
      throw new ProviderAdapterError({
        code: 'ADAPTER_ALREADY_REGISTERED',
        category: 'CONFIG',
        operation: 'RESOLVE_ADAPTER',
        providerCode: code,
        retryable: false,
        safeMessage: 'Provider adapter is already registered',
        internalMessage: `Adapter code "${code}" is already registered`,
      });
    }

    this.adapters.set(code, adapter);
  }

  has(code: ProviderAdapterCode): boolean {
    return this.adapters.has(code);
  }

  get(code: ProviderAdapterCode): ProviderAdapter {
    const adapter = this.adapters.get(code);

    if (!adapter) {
      throw new ProviderAdapterError({
        code: 'ADAPTER_NOT_FOUND',
        category: 'CONFIG',
        operation: 'RESOLVE_ADAPTER',
        providerCode: code?.length ? code : 'UNKNOWN',
        retryable: false,
        safeMessage: 'Provider adapter was not found',
        internalMessage: `No adapter registered for code "${String(code)}"`,
      });
    }

    return adapter;
  }

  listCodes(): readonly ProviderAdapterCode[] {
    return [...this.adapters.keys()];
  }
}
