import type { ProviderCapabilities } from './provider-capabilities';
import type {
  ProviderAdapterError,
  ProviderOperation,
} from './provider-errors';
import type {
  AllocateNumberRequest,
  AllocateNumberResult,
  CancelOrderRequest,
  NormalizedProviderEvent,
  NormalizedProviderSms,
  PollMessagesRequest,
  ProviderAdapterCode,
  ProviderBalanceResult,
  ProviderConfigValidationResult,
  ProviderContext,
  ProviderWebhookRequest,
  ReleaseNumberRequest,
} from './provider-types';

/**
 * Provider protocol boundary only: auth, signing, request/response normalization.
 * Must not write Order / Wallet / PhoneResource / Sms, and must not perform DB I/O.
 */
export interface ProviderAdapter {
  readonly code: ProviderAdapterCode;

  getCapabilities(): ProviderCapabilities;

  validateConfig(config: unknown): ProviderConfigValidationResult;

  /**
   * Normalize upstream failures into ProviderAdapterError.
   * Must not leak raw provider response bodies into returned fields.
   */
  mapError(error: unknown, operation: ProviderOperation): ProviderAdapterError;

  allocateNumber?(
    ctx: ProviderContext,
    request: AllocateNumberRequest,
  ): Promise<AllocateNumberResult>;

  pollMessages?(
    ctx: ProviderContext,
    request: PollMessagesRequest,
  ): Promise<NormalizedProviderSms[]>;

  verifyWebhook?(
    ctx: ProviderContext,
    request: ProviderWebhookRequest,
  ): Promise<void>;

  parseWebhook?(
    ctx: ProviderContext,
    request: ProviderWebhookRequest,
  ): Promise<NormalizedProviderEvent[]>;

  cancelOrder?(
    ctx: ProviderContext,
    request: CancelOrderRequest,
  ): Promise<void>;

  releaseNumber?(
    ctx: ProviderContext,
    request: ReleaseNumberRequest,
  ): Promise<void>;

  queryBalance?(ctx: ProviderContext): Promise<ProviderBalanceResult>;
}
