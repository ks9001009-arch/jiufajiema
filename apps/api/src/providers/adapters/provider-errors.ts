export type ProviderOperation =
  | 'VALIDATE_CONFIG'
  | 'RESOLVE_ADAPTER'
  | 'ALLOCATE_NUMBER'
  | 'POLL_MESSAGES'
  | 'VERIFY_WEBHOOK'
  | 'PARSE_WEBHOOK'
  | 'CANCEL_ORDER'
  | 'RELEASE_NUMBER'
  | 'QUERY_BALANCE'
  | 'INGRESS_SMS';

export type ProviderErrorCategory =
  | 'UNSUPPORTED'
  | 'CONFIG'
  | 'AUTH'
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'UPSTREAM'
  | 'UNKNOWN';

export type ProviderAdapterErrorParams = {
  code: string;
  category: ProviderErrorCategory;
  operation: ProviderOperation;
  providerCode: string;
  retryable: boolean;
  safeMessage: string;
  internalMessage?: string;
  upstreamCode?: string;
  cause?: unknown;
};

/**
 * Normalized adapter-layer error.
 * HTTP status mapping lives outside this core type.
 */
export class ProviderAdapterError extends Error {
  readonly code: string;
  readonly category: ProviderErrorCategory;
  readonly operation: ProviderOperation;
  readonly providerCode: string;
  readonly retryable: boolean;
  readonly safeMessage: string;
  readonly internalMessage?: string;
  readonly upstreamCode?: string;

  constructor(params: ProviderAdapterErrorParams) {
    const message = params.internalMessage ?? params.safeMessage;
    super(
      message,
      params.cause !== undefined ? { cause: params.cause } : undefined,
    );
    this.name = 'ProviderAdapterError';
    this.code = params.code;
    this.category = params.category;
    this.operation = params.operation;
    this.providerCode = params.providerCode;
    this.retryable = params.retryable;
    this.safeMessage = params.safeMessage;
    this.internalMessage = params.internalMessage;
    this.upstreamCode = params.upstreamCode;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
