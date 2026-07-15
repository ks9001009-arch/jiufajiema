import { UnrecoverableError } from 'bullmq';
import { ProviderAdapterError } from '../providers/adapters/provider-errors';
import {
  PROVIDER_POLL_ATTEMPTS,
  PROVIDER_POLL_BACKOFF_DELAY_MS,
  PROVIDER_POLL_JOB_NAME,
  ProviderPollingQueueService,
  buildProviderPollJobId,
  isRetryableProviderAdapterError,
} from './provider-polling-queue.service';

describe('ProviderPollingQueueService', () => {
  const providerId = 'provider-1';
  const orderId = 'order-1';

  let poll: jest.Mock;
  let queueAdd: jest.Mock;
  let service: ProviderPollingQueueService;

  beforeEach(() => {
    poll = jest.fn().mockResolvedValue({
      providerId,
      received: 0,
      completed: 0,
      ignored: 0,
      results: [],
    });
    queueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });

    service = new ProviderPollingQueueService({
      poll,
    } as never);

    // Simulate a ready queue without Redis.
    (service as unknown as { queue: { add: jest.Mock } }).queue = {
      add: queueAdd,
    };
  });

  it('builds a stable jobId from provider and order/phone/generic', () => {
    expect(buildProviderPollJobId({ providerId, orderId })).toBe(
      `provider-poll:${providerId}:${orderId}`,
    );
    expect(buildProviderPollJobId({ providerId, phone: '10086' })).toBe(
      `provider-poll:${providerId}:10086`,
    );
    expect(buildProviderPollJobId({ providerId })).toBe(
      `provider-poll:${providerId}:generic`,
    );
  });

  it('enqueuePoll uses stable jobId, attempts, and exponential backoff', async () => {
    const result = await service.enqueuePoll({ providerId, orderId });

    expect(result).toEqual({
      enqueued: true,
      jobId: `provider-poll:${providerId}:${orderId}`,
    });
    expect(queueAdd).toHaveBeenCalledWith(
      PROVIDER_POLL_JOB_NAME,
      { providerId, orderId },
      expect.objectContaining({
        jobId: `provider-poll:${providerId}:${orderId}`,
        attempts: PROVIDER_POLL_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: PROVIDER_POLL_BACKOFF_DELAY_MS,
        },
        removeOnComplete: true,
        removeOnFail: true,
      }),
    );
  });

  it('processJob calls ProviderPollingService.poll', async () => {
    await service.processJob({ providerId, orderId });
    expect(poll).toHaveBeenCalledWith({ providerId, orderId });
  });

  it('rethrows retryable ProviderAdapterError for BullMQ retries', async () => {
    const error = new ProviderAdapterError({
      code: 'UPSTREAM_BUSY',
      category: 'RATE_LIMIT',
      operation: 'POLL_MESSAGES',
      providerCode: 'test',
      retryable: true,
      safeMessage: 'rate limited',
    });
    poll.mockRejectedValue(error);

    await expect(service.processJob({ providerId, orderId })).rejects.toBe(
      error,
    );
    expect(isRetryableProviderAdapterError(error)).toBe(true);
  });

  it('wraps non-retryable errors as UnrecoverableError', async () => {
    const error = new ProviderAdapterError({
      code: 'POLLING_UNSUPPORTED',
      category: 'UNSUPPORTED',
      operation: 'POLL_MESSAGES',
      providerCode: 'manual',
      retryable: false,
      safeMessage: 'unsupported',
    });
    poll.mockRejectedValue(error);

    await expect(
      service.processJob({ providerId, orderId }),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(isRetryableProviderAdapterError(error)).toBe(false);
  });

  it('returns queue_unavailable without mutating business when Redis is down', async () => {
    (service as unknown as { queue: null }).queue = null;

    const result = await service.enqueuePoll({ providerId, orderId });

    expect(result).toEqual({
      enqueued: false,
      reason: 'queue_unavailable',
      jobId: `provider-poll:${providerId}:${orderId}`,
    });
    expect(poll).not.toHaveBeenCalled();
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it('returns enqueue_failed when queue.add rejects duplicate jobId', async () => {
    queueAdd.mockRejectedValue(new Error('Job already exists'));

    const result = await service.enqueuePoll({ providerId, orderId });

    expect(result).toEqual({
      enqueued: false,
      reason: 'enqueue_failed',
      jobId: `provider-poll:${providerId}:${orderId}`,
    });
    expect(poll).not.toHaveBeenCalled();
  });
});
