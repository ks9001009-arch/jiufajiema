import type { TransformFnParams } from 'class-transformer';

export const ORDER_STATUSES = [
  'PENDING',
  'WAIT_SMS',
  'SUCCESS',
  'FAILED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TERMINAL_ORDER_STATUSES = [
  'SUCCESS',
  'FAILED',
  'CANCELLED',
] as const;

export type TerminalOrderStatus = (typeof TERMINAL_ORDER_STATUSES)[number];

export const UPDATABLE_ORDER_STATUSES = [
  'SUCCESS',
  'FAILED',
  'CANCELLED',
] as const;

export const DECIMAL_AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,5})(?:\.\d{1,4})?$/;

export function trimString({ value }: TransformFnParams) {
  return typeof value === 'string' ? value.trim() : value;
}
