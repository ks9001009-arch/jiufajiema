export function getOrderWaitSmsTimeoutSeconds(): number {
  const configured = process.env.ORDER_WAIT_SMS_TIMEOUT_SECONDS?.trim();
  const parsed = configured ? Number.parseInt(configured, 10) : 300;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 300;
  }

  return parsed;
}

export function buildOrderTimeoutJobId(orderId: string): string {
  return `order-timeout-${orderId}`;
}
