import { Injectable } from '@nestjs/common';
import type { ProviderAdapter } from '../provider-adapter.interface';
import { createUnsupportedProviderCapabilities } from '../provider-capabilities';
import {
  ProviderAdapterError,
  type ProviderOperation,
} from '../provider-errors';
import type {
  ProviderAdapterCode,
  ProviderConfigValidationResult,
} from '../provider-types';
import { MANUAL_PROVIDER_ADAPTER_CODE } from './manual.adapter.constants';

@Injectable()
export class ManualAdapter implements ProviderAdapter {
  readonly code: ProviderAdapterCode = MANUAL_PROVIDER_ADAPTER_CODE;

  getCapabilities() {
    return createUnsupportedProviderCapabilities();
  }

  validateConfig(config: unknown): ProviderConfigValidationResult {
    if (config === null || config === undefined) {
      return { ok: true };
    }

    if (isEmptyPlainObject(config)) {
      return { ok: true };
    }

    return {
      ok: false,
      errors: [
        'Manual adapter accepts only null, undefined, or an empty plain object config',
      ],
    };
  }

  mapError(error: unknown, operation: ProviderOperation): ProviderAdapterError {
    return new ProviderAdapterError({
      code: 'MANUAL_ADAPTER_ERROR',
      category: 'UNKNOWN',
      operation,
      providerCode: MANUAL_PROVIDER_ADAPTER_CODE,
      retryable: false,
      safeMessage: 'Manual provider adapter operation failed',
      internalMessage: summarizeError(error),
      cause: error instanceof Error ? error : undefined,
    });
  }
}

function isEmptyPlainObject(config: unknown): boolean {
  if (typeof config !== 'object' || config === null) {
    return false;
  }

  if (Array.isArray(config)) {
    return false;
  }

  if (config instanceof Date) {
    return false;
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(config)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(config);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  return Object.keys(config).length === 0;
}

function summarizeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`.slice(0, 200);
  }

  if (typeof error === 'string') {
    return error.slice(0, 200);
  }

  return 'Non-Error value thrown';
}
