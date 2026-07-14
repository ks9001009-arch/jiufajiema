export function getOrderCurrency(): string {
  const configured = process.env.ORDER_CURRENCY?.trim().toUpperCase();

  return configured || 'USD';
}

export function buildOrderWalletIdempotencyKey(
  orderId: string,
  action: 'freeze' | 'capture' | 'release',
): string {
  return `order:${orderId}:${action}`;
}
