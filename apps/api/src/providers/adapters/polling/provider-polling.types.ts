export type ProviderPollingInput = {
  providerId: string;
  orderId?: string;
  phone?: string;
  since?: Date;
  limit?: number;
};

export type ProviderPollingMessageOutcome =
  'completed' | 'ignored_terminal' | 'ignored_invalid_message';

export type ProviderPollingMessageResult = {
  orderId?: string;
  providerMessageId?: string;
  outcome: ProviderPollingMessageOutcome;
};

export type ProviderPollingResult = {
  providerId: string;
  received: number;
  completed: number;
  ignored: number;
  results: ProviderPollingMessageResult[];
};

export type EnqueueProviderPollResult =
  | {
      enqueued: true;
      jobId: string;
    }
  | {
      enqueued: false;
      reason: 'queue_unavailable' | 'enqueue_failed';
      jobId: string;
    };
