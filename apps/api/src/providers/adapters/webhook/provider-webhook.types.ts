export type ProviderWebhookEventOutcome =
  | 'completed'
  | 'ignored_terminal'
  | 'ignored_unsupported_event'
  | 'ignored_invalid_event';

export type ProviderWebhookEventResult = {
  type: string;
  orderId?: string;
  outcome: ProviderWebhookEventOutcome;
};

export type ProviderWebhookResponse = {
  providerId: string;
  received: number;
  completed: number;
  ignored: number;
  results: ProviderWebhookEventResult[];
};
