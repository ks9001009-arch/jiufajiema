import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, UnrecoverableError, Worker } from 'bullmq';
import { ProviderAdapterError } from '../providers/adapters/provider-errors';
import { ProviderPollingService } from '../providers/adapters/polling/provider-polling.service';
import type {
  EnqueueProviderPollResult,
  ProviderPollingInput,
} from '../providers/adapters/polling/provider-polling.types';

export const PROVIDER_POLLING_QUEUE_NAME = 'provider-poll';
export const PROVIDER_POLL_JOB_NAME = 'provider-poll';
export const PROVIDER_POLL_ATTEMPTS = 3;
export const PROVIDER_POLL_BACKOFF_DELAY_MS = 1_000;

export function buildProviderPollJobId(input: {
  providerId: string;
  orderId?: string;
  phone?: string;
}): string {
  const scope = input.orderId?.trim() || input.phone?.trim() || 'generic';
  return `provider-poll:${input.providerId}:${scope}`;
}

type ProviderPollJobPayload = ProviderPollingInput;

@Injectable()
export class ProviderPollingQueueService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ProviderPollingQueueService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private connectionOptions: {
    url: string;
    maxRetriesPerRequest: null;
  } | null = null;

  constructor(
    private readonly providerPollingService: ProviderPollingService,
  ) {}

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL?.trim();

    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL is not configured; provider polling queue is disabled.',
      );
      return;
    }

    try {
      this.connectionOptions = {
        url: redisUrl,
        maxRetriesPerRequest: null,
      };

      this.queue = new Queue(PROVIDER_POLLING_QUEUE_NAME, {
        connection: this.connectionOptions,
      });

      this.worker = new Worker(
        PROVIDER_POLLING_QUEUE_NAME,
        async (job) => this.processJob(job.data),
        {
          connection: this.connectionOptions,
        },
      );

      this.worker.on('failed', (job, error) => {
        this.logger.error(
          `Provider poll job failed for ${job?.id ?? 'unknown'}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
    } catch (error) {
      this.logger.warn(
        'Failed to initialize provider polling queue.',
        error instanceof Error ? error.stack : String(error),
      );
      await this.closeQueueResources();
    }
  }

  async onModuleDestroy() {
    await this.closeQueueResources();
  }

  isQueueAvailable() {
    return this.queue !== null;
  }

  async enqueuePoll(
    input: ProviderPollingInput,
    options?: { delayMs?: number },
  ): Promise<EnqueueProviderPollResult> {
    const jobId = buildProviderPollJobId(input);

    if (!this.queue) {
      this.logger.warn(
        `Provider polling queue unavailable for job ${jobId}; poll was not enqueued.`,
      );
      return {
        enqueued: false,
        reason: 'queue_unavailable',
        jobId,
      };
    }

    try {
      await this.queue.add(PROVIDER_POLL_JOB_NAME, input, {
        jobId,
        attempts: PROVIDER_POLL_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: PROVIDER_POLL_BACKOFF_DELAY_MS,
        },
        delay: options?.delayMs,
        removeOnComplete: true,
        removeOnFail: true,
      });

      return {
        enqueued: true,
        jobId,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue provider poll job ${jobId}.`,
        error instanceof Error ? error.stack : String(error),
      );
      return {
        enqueued: false,
        reason: 'enqueue_failed',
        jobId,
      };
    }
  }

  /**
   * Worker entry used by BullMQ and unit tests.
   * Retryable ProviderAdapterError is rethrown; others become UnrecoverableError.
   */
  async processJob(input: ProviderPollJobPayload) {
    try {
      return await this.providerPollingService.poll(input);
    } catch (error) {
      if (isRetryableProviderAdapterError(error)) {
        throw error;
      }

      throw new UnrecoverableError(summarizePollingWorkerError(error));
    }
  }

  private async closeQueueResources() {
    await this.worker?.close();
    await this.queue?.close();

    this.worker = null;
    this.queue = null;
    this.connectionOptions = null;
  }
}

export function isRetryableProviderAdapterError(error: unknown): boolean {
  return error instanceof ProviderAdapterError && error.retryable === true;
}

function summarizePollingWorkerError(error: unknown): string {
  if (error instanceof ProviderAdapterError) {
    return `${error.code}: ${error.safeMessage}`;
  }

  if (error instanceof Error) {
    return error.message.slice(0, 200);
  }

  return 'Provider poll failed';
}
