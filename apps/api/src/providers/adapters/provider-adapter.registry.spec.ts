import { ProviderAdapterError } from './provider-errors';
import { ProviderAdapterRegistry } from './provider-adapter.registry';
import { ManualAdapter } from './manual/manual.adapter';
import { MANUAL_PROVIDER_ADAPTER_CODE } from './manual/manual.adapter.constants';
import type { ProviderAdapter } from './provider-adapter.interface';
import { createUnsupportedProviderCapabilities } from './provider-capabilities';

describe('ProviderAdapterRegistry', () => {
  let registry: ProviderAdapterRegistry;
  let manualAdapter: ManualAdapter;

  beforeEach(() => {
    registry = new ProviderAdapterRegistry();
    manualAdapter = new ManualAdapter();
  });

  it('registers manual and returns it from get()', () => {
    registry.register(manualAdapter);

    expect(registry.has(MANUAL_PROVIDER_ADAPTER_CODE)).toBe(true);
    expect(registry.get(MANUAL_PROVIDER_ADAPTER_CODE)).toBe(manualAdapter);
  });

  it('throws ADAPTER_NOT_FOUND for unknown adapter', () => {
    try {
      registry.get('unknown-adapter');
      fail('expected ProviderAdapterError');
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderAdapterError);
      expect((error as ProviderAdapterError).code).toBe('ADAPTER_NOT_FOUND');
      expect((error as ProviderAdapterError).category).toBe('CONFIG');
      expect((error as ProviderAdapterError).operation).toBe('RESOLVE_ADAPTER');
      expect((error as ProviderAdapterError).retryable).toBe(false);
      expect((error as ProviderAdapterError).providerCode).toBe(
        'unknown-adapter',
      );
    }
  });

  it('throws ADAPTER_ALREADY_REGISTERED on duplicate code', () => {
    registry.register(manualAdapter);

    try {
      registry.register(manualAdapter);
      fail('expected ProviderAdapterError');
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderAdapterError);
      expect((error as ProviderAdapterError).code).toBe(
        'ADAPTER_ALREADY_REGISTERED',
      );
      expect((error as ProviderAdapterError).providerCode).toBe(
        MANUAL_PROVIDER_ADAPTER_CODE,
      );
    }
  });

  it('listCodes returns a new array that does not mutate internal map', () => {
    registry.register(manualAdapter);
    const codes = registry.listCodes() as ProviderAdapterCodeMutable[];
    codes.push('mutated');

    expect(registry.listCodes()).toEqual([MANUAL_PROVIDER_ADAPTER_CODE]);
    expect(registry.has('mutated')).toBe(false);
  });

  it('rejects empty or whitespace-only adapter codes', () => {
    const emptyCodeAdapter = createStubAdapter('');
    const whitespaceAdapter = createStubAdapter('   ');

    try {
      registry.register(emptyCodeAdapter);
      fail('expected ProviderAdapterError');
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderAdapterError);
      expect((error as ProviderAdapterError).code).toBe('ADAPTER_CODE_INVALID');
      expect((error as ProviderAdapterError).providerCode).toBe('UNKNOWN');
    }

    try {
      registry.register(whitespaceAdapter);
      fail('expected ProviderAdapterError');
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderAdapterError);
      expect((error as ProviderAdapterError).code).toBe('ADAPTER_CODE_INVALID');
    }
  });
});

type ProviderAdapterCodeMutable = string[];

function createStubAdapter(code: string): ProviderAdapter {
  return {
    code,
    getCapabilities: () => createUnsupportedProviderCapabilities(),
    validateConfig: () => ({ ok: true }),
    mapError: (error, operation) =>
      new ProviderAdapterError({
        code: 'STUB',
        category: 'UNKNOWN',
        operation,
        providerCode: code || 'UNKNOWN',
        retryable: false,
        safeMessage: 'stub',
        cause: error instanceof Error ? error : undefined,
      }),
  };
}
