import { Injectable } from '@nestjs/common';
import { ProviderSmsIngressService } from '../ingress/provider-sms-ingress.service';
import { ProviderAdapterFactory } from '../provider-adapter.factory';
import { ProviderAdapterError } from '../provider-errors';
import type { NormalizedProviderSms } from '../provider-types';
import type {
  ProviderPollingInput,
  ProviderPollingMessageResult,
  ProviderPollingResult,
} from './provider-polling.types';

/**
 * Provider polling domain service.
 * Calls adapters outside any DB transaction; SMS completion goes through ingress only.
 */
@Injectable()
export class ProviderPollingService {
  constructor(
    private readonly providerAdapterFactory: ProviderAdapterFactory,
    private readonly providerSmsIngressService: ProviderSmsIngressService,
  ) {}

  async poll(input: ProviderPollingInput): Promise<ProviderPollingResult> {
    if (!input.providerId?.trim()) {
      throw new ProviderAdapterError({
        code: 'POLLING_PROVIDER_ID_REQUIRED',
        category: 'INVALID_REQUEST',
        operation: 'POLL_MESSAGES',
        providerCode: 'UNKNOWN',
        retryable: false,
        safeMessage: 'providerId is required for polling',
      });
    }

    const { adapter, context } =
      await this.providerAdapterFactory.resolveByProviderId(input.providerId);

    const capabilities = adapter.getCapabilities();

    if (!capabilities.pollMessages) {
      throw new ProviderAdapterError({
        code: 'POLLING_UNSUPPORTED',
        category: 'UNSUPPORTED',
        operation: 'POLL_MESSAGES',
        providerCode: adapter.code,
        retryable: false,
        safeMessage: 'Provider adapter does not support polling',
      });
    }

    if (!adapter.pollMessages) {
      throw new ProviderAdapterError({
        code: 'POLLING_METHOD_MISSING',
        category: 'CONFIG',
        operation: 'POLL_MESSAGES',
        providerCode: adapter.code,
        retryable: false,
        safeMessage: 'Provider adapter pollMessages is not implemented',
      });
    }

    const messages = await adapter.pollMessages(context, {
      orderId: input.orderId,
      phone: input.phone,
      since: input.since,
      limit: input.limit,
    });

    const results: ProviderPollingMessageResult[] = [];
    let completed = 0;
    let ignored = 0;

    for (const message of messages) {
      const handled = await this.handleMessage(
        message,
        context.companyId,
        input.providerId,
      );
      results.push(handled);

      if (handled.outcome === 'completed') {
        completed += 1;
      } else {
        ignored += 1;
      }
    }

    return {
      providerId: input.providerId,
      received: messages.length,
      completed,
      ignored,
      results,
    };
  }

  private async handleMessage(
    message: NormalizedProviderSms,
    companyId: string,
    providerId: string,
  ): Promise<ProviderPollingMessageResult> {
    const orderId = message.orderId?.trim();
    const code = message.code?.trim() || null;
    const content = message.content?.trim() || null;

    if (
      !orderId ||
      !(message.receivedAt instanceof Date) ||
      Number.isNaN(message.receivedAt.getTime()) ||
      (!code && !content)
    ) {
      return {
        orderId: orderId || undefined,
        providerMessageId: message.providerMessageId,
        outcome: 'ignored_invalid_message',
      };
    }

    const ingressResult = await this.providerSmsIngressService.accept({
      source: 'polling',
      companyId,
      providerId,
      orderId,
      code,
      content,
      receivedAt: message.receivedAt,
      providerMessageId: message.providerMessageId,
    });

    return {
      orderId,
      providerMessageId: message.providerMessageId,
      outcome: ingressResult.outcome,
    };
  }
}
