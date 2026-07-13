import { BadRequestException } from '@nestjs/common';

export const POSITIVE_WALLET_AMOUNT_PATTERN =
  /^(?:0\.(?:0*[1-9]\d{0,3})|[1-9]\d{0,13}(?:\.\d{1,4})?)$/;

const SCALE = 10000n;

function normalizeAmountString(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new BadRequestException('amount is required');
  }

  const [integerPart, fractionalPart = ''] = trimmed.split('.');
  const normalizedFraction = `${fractionalPart}0000`.slice(0, 4);

  return `${integerPart}.${normalizedFraction}`;
}

function toScaled(value: string): bigint {
  const normalized = normalizeAmountString(value);
  const [integerPart, fractionalPart] = normalized.split('.');
  const sign = integerPart.startsWith('-') ? -1n : 1n;
  const absoluteInteger = integerPart.replace('-', '') || '0';
  const scaled =
    BigInt(absoluteInteger) * SCALE + BigInt(fractionalPart || '0');

  return sign * scaled;
}

function fromScaled(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const integerPart = absolute / SCALE;
  const fractionalPart = (absolute % SCALE).toString().padStart(4, '0');

  return `${negative ? '-' : ''}${integerPart}.${fractionalPart}`;
}

export function parsePositiveWalletAmount(value: string): string {
  const trimmed = value.trim();

  if (!POSITIVE_WALLET_AMOUNT_PATTERN.test(trimmed)) {
    throw new BadRequestException(
      'amount must be a positive decimal with up to 4 decimal places',
    );
  }

  const scaled = toScaled(trimmed);

  if (scaled <= 0n) {
    throw new BadRequestException('amount must be greater than 0');
  }

  return normalizeAmountString(trimmed);
}

export function addWalletAmount(left: string, right: string): string {
  return fromScaled(toScaled(left) + toScaled(right));
}

export function subtractWalletAmount(left: string, right: string): string {
  return fromScaled(toScaled(left) - toScaled(right));
}

export function isWalletAmountNegative(value: string): boolean {
  return toScaled(value) < 0n;
}

export function isWalletAmountZero(value: string): boolean {
  return toScaled(value) === 0n;
}

export function walletAmountToString(
  value: string | { toString(): string },
): string {
  return normalizeAmountString(value.toString());
}
