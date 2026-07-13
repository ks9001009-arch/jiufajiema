import type { TransformFnParams } from 'class-transformer';

export const PHONE_RESOURCE_STATUSES = [
  'AVAILABLE',
  'LOCKED',
  'USED',
  'EXPIRED',
  'DISABLED',
] as const;

export type PhoneResourceStatus = (typeof PHONE_RESOURCE_STATUSES)[number];

export const E164_PHONE_PATTERN = /^\+[1-9]\d{1,14}$/;
export const ISO_COUNTRY_PATTERN = /^[A-Z]{2}$/;
export const DECIMAL_COST_PATTERN = /^(?:0|[1-9]\d{0,5})(?:\.\d{1,4})?$/;

export function trimString({ value }: TransformFnParams) {
  return typeof value === 'string' ? value.trim() : value;
}

export function uppercaseString({ value }: TransformFnParams) {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}
