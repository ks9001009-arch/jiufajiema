import { IsIn } from 'class-validator';
import { UPDATABLE_ORDER_STATUSES } from './order.validation';
import type { TerminalOrderStatus } from './order.validation';

export class UpdateOrderStatusDto {
  @IsIn(UPDATABLE_ORDER_STATUSES)
  status: TerminalOrderStatus;
}
