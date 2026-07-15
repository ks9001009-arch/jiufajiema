import { ManualAdapter } from './manual.adapter';
import { MANUAL_PROVIDER_ADAPTER_CODE } from './manual.adapter.constants';
import { ProviderAdapterError } from '../provider-errors';
import { createUnsupportedProviderCapabilities } from '../provider-capabilities';

describe('ManualAdapter', () => {
  const adapter = new ManualAdapter();

  it('uses manual adapter code', () => {
    expect(adapter.code).toBe(MANUAL_PROVIDER_ADAPTER_CODE);
  });

  it('returns all-false capabilities', () => {
    expect(adapter.getCapabilities()).toEqual(
      createUnsupportedProviderCapabilities(),
    );
  });

  it('accepts null, undefined, and empty plain object config', () => {
    expect(adapter.validateConfig(null)).toEqual({ ok: true });
    expect(adapter.validateConfig(undefined)).toEqual({ ok: true });
    expect(adapter.validateConfig({})).toEqual({ ok: true });
  });

  it('rejects arrays, non-empty objects, Date, and class instances', () => {
    class SampleConfig {}

    expect(adapter.validateConfig([]).ok).toBe(false);
    expect(adapter.validateConfig({ apiKey: 'x' }).ok).toBe(false);
    expect(adapter.validateConfig(new Date()).ok).toBe(false);
    expect(adapter.validateConfig(new SampleConfig()).ok).toBe(false);
    expect(adapter.validateConfig(Buffer.from('x')).ok).toBe(false);
  });

  it('mapError returns ProviderAdapterError without leaking into safeMessage', () => {
    const result = adapter.mapError(
      new Error('secret upstream detail'),
      'ALLOCATE_NUMBER',
    );

    expect(result).toBeInstanceOf(ProviderAdapterError);
    expect(result).toBeInstanceOf(Error);
    expect(result.providerCode).toBe(MANUAL_PROVIDER_ADAPTER_CODE);
    expect(result.category).toBe('UNKNOWN');
    expect(result.retryable).toBe(false);
    expect(result.operation).toBe('ALLOCATE_NUMBER');
    expect(result.safeMessage).toBe('Manual provider adapter operation failed');
    expect(result.safeMessage).not.toContain('secret upstream detail');
    expect(result.internalMessage).toContain('secret upstream detail');
  });
});
