/**
 * Decimal amount string. Never use JS number for money.
 * Aligns with order/wallet DECIMAL amount conventions.
 */
export type DecimalString = string;

export type ProviderAdapterCode = string;

export interface ProviderContext {
  companyId: string;
  providerId: string;
  adapterCode: ProviderAdapterCode;
  /** Opaque provider config; adapters parse privately. */
  config: unknown;
  actorUserId?: string | null;
}

export interface AllocateNumberRequest {
  serviceCode: string;
  country: string;
  orderId?: string;
  maxPrice?: DecimalString;
}

export interface AllocateNumberResult {
  phone: string;
  country: string;
  providerExternalId?: string;
  providerResourceId?: string;
  expiresAt?: Date;
  /** Upstream quote; must not auto-equal Order.amount. */
  rawCost?: DecimalString;
}

export interface ProviderOrderReference {
  orderId: string;
  providerExternalId?: string;
}

export interface PollMessagesRequest {
  orderId?: string;
  phone?: string;
  since?: Date;
  /** Message count limit (not a money amount). */
  limit?: number;
}

export interface NormalizedProviderSms {
  orderId: string;
  receivedAt: Date;
  code?: string;
  content?: string;
  providerMessageId?: string;
  phone?: string;
}

/**
 * Raw inbound webhook material at the adapter boundary only.
 * Do not put parsed arbitrary payloads on this type for core layers.
 */
export interface ProviderWebhookRequest {
  headers: Readonly<Record<string, string | string[] | undefined>>;
  rawBody: Buffer;
  query?: Readonly<Record<string, string | string[] | undefined>>;
  providerId?: string;
}

export type NormalizedProviderEventType =
  'SMS_RECEIVED' | 'ORDER_STATUS' | 'UNKNOWN';

export interface NormalizedProviderEvent {
  type: NormalizedProviderEventType;
  occurredAt: Date;
  orderId?: string;
  sms?: NormalizedProviderSms;
  providerExternalId?: string;
  providerMessageId?: string;
}

export interface CancelOrderRequest {
  orderId: string;
  providerExternalId?: string;
  reason?: string;
}

/**
 * Runtime must ensure at least one of `phone` or `providerResourceId` is present.
 * TypeScript cannot express XOR here without awkward unions.
 */
export interface ReleaseNumberRequest {
  phone?: string;
  providerResourceId?: string;
  orderId?: string;
}

export interface ProviderBalanceResult {
  currency: string;
  available: DecimalString;
  frozen?: DecimalString;
}

export type ProviderConfigValidationResult =
  { ok: true } | { ok: false; errors: readonly string[] };
