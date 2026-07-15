import { ConflictException } from '@nestjs/common';

/**
 * Thrown when SMS completion targets an order already in SUCCESS / FAILED / CANCELLED.
 * Ingress uses `instanceof` / `code` — never message text — for ignored_terminal.
 */
export class OrderTerminalStateConflictException extends ConflictException {
  readonly code = 'ORDER_TERMINAL' as const;

  constructor(orderStatus?: string) {
    super({
      code: 'ORDER_TERMINAL',
      message: 'Order is already in a terminal status',
      ...(orderStatus ? { orderStatus } : {}),
    });
    this.name = 'OrderTerminalStateConflictException';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
