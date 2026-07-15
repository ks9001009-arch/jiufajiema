import { Controller, Headers, Param, Post, Query, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ProviderSmsIngressService } from '../ingress/provider-sms-ingress.service';
import { ProviderAdapterFactory } from '../provider-adapter.factory';
import { ProviderAdapterError } from '../provider-errors';
import type {
  NormalizedProviderEvent,
  ProviderWebhookRequest,
} from '../provider-types';
import type {
  ProviderWebhookEventResult,
  ProviderWebhookResponse,
} from './provider-webhook.types';

/**
 * Public provider webhook ingress (no JWT).
 *
 * Route: POST /provider-webhooks/:providerId
 *
 * Error strategy:
 * - verifyWebhook / parseWebhook failures fail the whole request
 * - per-event: ignored outcomes continue; non-idempotent business errors fail the request
 * - terminal OrderTerminalStateConflictException becomes ignored_terminal and continues
 */
@Controller('provider-webhooks')
export class ProviderWebhookController {
  constructor(
    private readonly providerAdapterFactory: ProviderAdapterFactory,
    private readonly providerSmsIngressService: ProviderSmsIngressService,
  ) {}

  @Post(':providerId')
  async handleWebhook(
    @Param('providerId') providerId: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: Record<string, string | string[] | undefined>,
  ): Promise<ProviderWebhookResponse> {
    const { adapter, context } =
      await this.providerAdapterFactory.resolveByProviderId(providerId);

    const capabilities = adapter.getCapabilities();

    if (!capabilities.webhook) {
      throw new ProviderAdapterError({
        code: 'WEBHOOK_UNSUPPORTED',
        category: 'UNSUPPORTED',
        operation: 'VERIFY_WEBHOOK',
        providerCode: adapter.code,
        retryable: false,
        safeMessage: 'Provider adapter does not support webhooks',
      });
    }

    if (!adapter.verifyWebhook || !adapter.parseWebhook) {
      throw new ProviderAdapterError({
        code: 'WEBHOOK_METHOD_MISSING',
        category: 'CONFIG',
        operation: adapter.verifyWebhook ? 'PARSE_WEBHOOK' : 'VERIFY_WEBHOOK',
        providerCode: adapter.code,
        retryable: false,
        safeMessage: 'Provider adapter webhook methods are not implemented',
      });
    }

    if (!req.rawBody) {
      throw new ProviderAdapterError({
        code: 'WEBHOOK_RAW_BODY_MISSING',
        category: 'CONFIG',
        operation: 'VERIFY_WEBHOOK',
        providerCode: adapter.code,
        retryable: false,
        safeMessage: 'Webhook raw body is not available',
      });
    }

    const webhookRequest: ProviderWebhookRequest = {
      headers: Object.freeze({ ...headers }),
      rawBody: req.rawBody,
      query: Object.freeze({ ...query }),
      providerId,
    };

    await adapter.verifyWebhook(context, webhookRequest);
    const events = await adapter.parseWebhook(context, webhookRequest);

    const results: ProviderWebhookEventResult[] = [];
    let completed = 0;
    let ignored = 0;

    for (const event of events) {
      const handled = await this.handleNormalizedEvent(
        event,
        context.companyId,
        providerId,
      );
      results.push(handled);

      if (handled.outcome === 'completed') {
        completed += 1;
      } else {
        ignored += 1;
      }
    }

    return {
      providerId,
      received: events.length,
      completed,
      ignored,
      results,
    };
  }

  private async handleNormalizedEvent(
    event: NormalizedProviderEvent,
    companyId: string,
    providerId: string,
  ): Promise<ProviderWebhookEventResult> {
    if (event.type !== 'SMS_RECEIVED') {
      return {
        type: event.type,
        orderId: event.orderId ?? event.sms?.orderId,
        outcome: 'ignored_unsupported_event',
      };
    }

    const orderId = event.orderId ?? event.sms?.orderId;
    const sms = event.sms;

    if (!orderId || !sms) {
      return {
        type: event.type,
        orderId,
        outcome: 'ignored_invalid_event',
      };
    }

    const code = sms.code?.trim() || null;
    const content = sms.content?.trim() || null;

    if (!code && !content) {
      return {
        type: event.type,
        orderId,
        outcome: 'ignored_invalid_event',
      };
    }

    if (
      !(sms.receivedAt instanceof Date) ||
      Number.isNaN(sms.receivedAt.getTime())
    ) {
      return {
        type: event.type,
        orderId,
        outcome: 'ignored_invalid_event',
      };
    }

    const ingressResult = await this.providerSmsIngressService.accept({
      source: 'webhook',
      companyId,
      providerId,
      orderId,
      code,
      content,
      receivedAt: sms.receivedAt,
      providerMessageId: sms.providerMessageId ?? event.providerMessageId,
    });

    return {
      type: event.type,
      orderId,
      outcome: ingressResult.outcome,
    };
  }
}
