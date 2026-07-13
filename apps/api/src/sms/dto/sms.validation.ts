export const SMS_STATUSES = ['RECEIVED', 'FAILED'] as const;

export type SmsStatus = (typeof SMS_STATUSES)[number];
