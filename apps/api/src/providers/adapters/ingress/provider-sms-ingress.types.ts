export type ProviderSmsIngressSource = 'webhook' | 'polling';

export type ProviderSmsIngressInput = {
  source: ProviderSmsIngressSource;
  companyId: string;
  providerId: string;
  orderId: string;
  code?: string | null;
  content?: string | null;
  receivedAt: Date;
  /** Reserved for future idempotency; not persisted in Phase 4. */
  providerMessageId?: string;
};

export type ProviderSmsIngressResult =
  | {
      outcome: 'completed';
      orderId: string;
    }
  | {
      outcome: 'ignored_terminal';
      orderId: string;
    };
