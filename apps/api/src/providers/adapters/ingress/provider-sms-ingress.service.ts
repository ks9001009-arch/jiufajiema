import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderSmsCompletionService } from '../../../sms/order-sms-completion.service';
import { OrderTerminalStateConflictException } from '../../../sms/order-terminal-state-conflict.exception';
import type {
  ProviderSmsIngressInput,
  ProviderSmsIngressResult,
} from './provider-sms-ingress.types';

@Injectable()
export class ProviderSmsIngressService {
  constructor(
    private readonly orderSmsCompletionService: OrderSmsCompletionService,
  ) {}

  async accept(
    input: ProviderSmsIngressInput,
  ): Promise<ProviderSmsIngressResult> {
    if (!input.companyId?.trim()) {
      throw new BadRequestException('companyId is required');
    }

    if (!input.providerId?.trim()) {
      throw new BadRequestException('providerId is required');
    }

    if (!input.orderId?.trim()) {
      throw new BadRequestException('orderId is required');
    }

    if (
      !(input.receivedAt instanceof Date) ||
      Number.isNaN(input.receivedAt.getTime())
    ) {
      throw new BadRequestException('receivedAt must be a valid Date');
    }

    const code = input.code?.trim() || null;
    const content = input.content?.trim() || null;

    if (!code && !content) {
      throw new BadRequestException('code 和 content 至少填写一项');
    }

    try {
      await this.orderSmsCompletionService.completeForOrder({
        orderId: input.orderId,
        companyId: input.companyId,
        providerId: input.providerId,
        code,
        content,
        receivedAt: input.receivedAt,
        actorUserId: null,
        source: 'webhook',
      });

      return {
        outcome: 'completed',
        orderId: input.orderId,
      };
    } catch (error) {
      if (error instanceof OrderTerminalStateConflictException) {
        return {
          outcome: 'ignored_terminal',
          orderId: input.orderId,
        };
      }

      throw error;
    }
  }
}
