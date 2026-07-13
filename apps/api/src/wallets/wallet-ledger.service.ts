import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  addWalletAmount,
  isWalletAmountNegative,
  parsePositiveWalletAmount,
  subtractWalletAmount,
  walletAmountToString,
} from './wallet-decimal.util';

type WalletAccountStatus = 'ACTIVE' | 'DISABLED';

type WalletTransactionType =
  | 'RECHARGE'
  | 'MANUAL_CREDIT'
  | 'MANUAL_DEBIT'
  | 'FREEZE'
  | 'RELEASE'
  | 'CAPTURE'
  | 'REFUND';

type WalletAccountRecord = {
  id: string;
  companyId: string;
  userId: string | null;
  currency: string;
  availableBalance: string;
  frozenBalance: string;
  status: WalletAccountStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

type WalletTransactionRecord = {
  id: string;
  walletAccountId: string;
  companyId: string;
  type: WalletTransactionType;
  amount: string;
  availableBefore: string;
  availableAfter: string;
  frozenBefore: string;
  frozenAfter: string;
  referenceType: string | null;
  referenceId: string | null;
  idempotencyKey: string;
  actorUserId: string | null;
  remark: string | null;
  createdAt: Date;
};

type LedgerMutationMode =
  | 'credit_available'
  | 'debit_available'
  | 'freeze'
  | 'release'
  | 'capture'
  | 'refund_available';

type ApplyLedgerParams = {
  walletAccountId: string;
  type: WalletTransactionType;
  amount: string;
  idempotencyKey: string;
  actorUserId: string;
  remark?: string;
  referenceType?: string;
  referenceId?: string;
  auditAction?: string;
};

@Injectable()
export class WalletLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  recharge(params: Omit<ApplyLedgerParams, 'type'>) {
    return this.applyMutation(
      {
        ...params,
        type: 'RECHARGE',
        auditAction: params.auditAction ?? 'wallet.recharge',
      },
      'credit_available',
    );
  }

  manualCredit(params: Omit<ApplyLedgerParams, 'type'>) {
    return this.applyMutation(
      {
        ...params,
        type: 'MANUAL_CREDIT',
        auditAction: params.auditAction ?? 'wallet.adjustment',
      },
      'credit_available',
    );
  }

  manualDebit(params: Omit<ApplyLedgerParams, 'type'>) {
    return this.applyMutation(
      {
        ...params,
        type: 'MANUAL_DEBIT',
        auditAction: params.auditAction ?? 'wallet.adjustment',
      },
      'debit_available',
    );
  }

  freeze(params: Omit<ApplyLedgerParams, 'type' | 'auditAction'>) {
    return this.applyMutation(
      {
        ...params,
        type: 'FREEZE',
      },
      'freeze',
    );
  }

  release(params: Omit<ApplyLedgerParams, 'type' | 'auditAction'>) {
    return this.applyMutation(
      {
        ...params,
        type: 'RELEASE',
      },
      'release',
    );
  }

  capture(params: Omit<ApplyLedgerParams, 'type' | 'auditAction'>) {
    return this.applyMutation(
      {
        ...params,
        type: 'CAPTURE',
      },
      'capture',
    );
  }

  refund(params: Omit<ApplyLedgerParams, 'type' | 'auditAction'>) {
    return this.applyMutation(
      {
        ...params,
        type: 'REFUND',
      },
      'refund_available',
    );
  }

  private async applyMutation(
    params: ApplyLedgerParams,
    mode: LedgerMutationMode,
  ) {
    const existing = await this.findExistingTransaction(params.idempotencyKey);

    if (existing) {
      const account = await this.prisma.walletAccount.findUnique({
        where: { id: existing.walletAccountId },
      });

      if (!account) {
        throw new NotFoundException(
          'Wallet account for existing transaction not found',
        );
      }

      return {
        idempotent: true,
        account: this.normalizeAccount(account),
        transaction: this.normalizeTransaction(existing),
      };
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "WalletAccount"
          WHERE "id" = ${params.walletAccountId}
          FOR UPDATE
        `;

        const account = await tx.walletAccount.findUnique({
          where: { id: params.walletAccountId },
        });

        if (!account) {
          throw new NotFoundException(
            `Wallet account with id "${params.walletAccountId}" not found`,
          );
        }

        if (account.status !== 'ACTIVE') {
          throw new BadRequestException('Wallet account is not active');
        }

        const amount = parsePositiveWalletAmount(params.amount);
        const normalizedAccount = this.normalizeAccount(account);
        const balances = this.computeNextBalances(
          normalizedAccount.availableBalance,
          normalizedAccount.frozenBalance,
          amount,
          mode,
        );

        const updated = await tx.walletAccount.update({
          where: {
            id: account.id,
            version: account.version,
          },
          data: {
            availableBalance: balances.availableAfter,
            frozenBalance: balances.frozenAfter,
            version: { increment: 1 },
          },
        });

        const transaction = await tx.walletTransaction.create({
          data: {
            walletAccountId: account.id,
            companyId: account.companyId,
            type: params.type,
            amount,
            availableBefore: balances.availableBefore,
            availableAfter: balances.availableAfter,
            frozenBefore: balances.frozenBefore,
            frozenAfter: balances.frozenAfter,
            referenceType: params.referenceType ?? null,
            referenceId: params.referenceId ?? null,
            idempotencyKey: params.idempotencyKey,
            actorUserId: params.actorUserId,
            remark: params.remark ?? null,
          },
        });

        if (params.auditAction) {
          await tx.auditLog.create({
            data: {
              action: params.auditAction,
              targetType: 'WalletAccount',
              targetId: account.id,
              actorUserId: params.actorUserId,
              companyId: account.companyId,
              beforeData: {
                availableBalance: balances.availableBefore,
                frozenBalance: balances.frozenBefore,
              },
              afterData: {
                availableBalance: balances.availableAfter,
                frozenBalance: balances.frozenAfter,
                transactionId: transaction.id,
                transactionType: transaction.type,
                amount,
                idempotencyKey: params.idempotencyKey,
                remark: params.remark ?? null,
              },
            },
          });
        }

        return {
          idempotent: false,
          account: this.normalizeAccount(updated),
          transaction: this.normalizeTransaction(transaction),
        };
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const existingAfterRace = await this.findExistingTransaction(
          params.idempotencyKey,
        );

        if (existingAfterRace) {
          const account = await this.prisma.walletAccount.findUnique({
            where: { id: existingAfterRace.walletAccountId },
          });

          if (!account) {
            throw new NotFoundException(
              'Wallet account for existing transaction not found',
            );
          }

          return {
            idempotent: true,
            account: this.normalizeAccount(account),
            transaction: this.normalizeTransaction(existingAfterRace),
          };
        }
      }

      throw error;
    }
  }

  private computeNextBalances(
    availableBefore: string,
    frozenBefore: string,
    amount: string,
    mode: LedgerMutationMode,
  ) {
    let availableAfter = availableBefore;
    let frozenAfter = frozenBefore;

    switch (mode) {
      case 'credit_available':
      case 'refund_available':
        availableAfter = addWalletAmount(availableBefore, amount);
        break;
      case 'debit_available':
        availableAfter = subtractWalletAmount(availableBefore, amount);
        if (isWalletAmountNegative(availableAfter)) {
          throw new BadRequestException('Insufficient available balance');
        }
        break;
      case 'freeze':
        availableAfter = subtractWalletAmount(availableBefore, amount);
        if (isWalletAmountNegative(availableAfter)) {
          throw new BadRequestException(
            'Insufficient available balance to freeze',
          );
        }
        frozenAfter = addWalletAmount(frozenBefore, amount);
        break;
      case 'release':
        frozenAfter = subtractWalletAmount(frozenBefore, amount);
        if (isWalletAmountNegative(frozenAfter)) {
          throw new BadRequestException(
            'Insufficient frozen balance to release',
          );
        }
        availableAfter = addWalletAmount(availableBefore, amount);
        break;
      case 'capture':
        frozenAfter = subtractWalletAmount(frozenBefore, amount);
        if (isWalletAmountNegative(frozenAfter)) {
          throw new BadRequestException(
            'Insufficient frozen balance to capture',
          );
        }
        break;
      default:
        throw new BadRequestException('Unsupported wallet mutation mode');
    }

    if (
      isWalletAmountNegative(availableAfter) ||
      isWalletAmountNegative(frozenAfter)
    ) {
      throw new BadRequestException('Wallet balance cannot be negative');
    }

    return {
      availableBefore,
      availableAfter,
      frozenBefore,
      frozenAfter,
    };
  }

  private normalizeAccount(account: {
    id: string;
    companyId: string;
    userId: string | null;
    currency: string;
    availableBalance: { toString(): string };
    frozenBalance: { toString(): string };
    status: WalletAccountStatus;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): WalletAccountRecord {
    return {
      id: account.id,
      companyId: account.companyId,
      userId: account.userId,
      currency: account.currency,
      availableBalance: walletAmountToString(account.availableBalance),
      frozenBalance: walletAmountToString(account.frozenBalance),
      status: account.status,
      version: account.version,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  private normalizeTransaction(transaction: {
    id: string;
    walletAccountId: string;
    companyId: string;
    type: WalletTransactionType;
    amount: { toString(): string };
    availableBefore: { toString(): string };
    availableAfter: { toString(): string };
    frozenBefore: { toString(): string };
    frozenAfter: { toString(): string };
    referenceType: string | null;
    referenceId: string | null;
    idempotencyKey: string;
    actorUserId: string | null;
    remark: string | null;
    createdAt: Date;
  }): WalletTransactionRecord {
    return {
      id: transaction.id,
      walletAccountId: transaction.walletAccountId,
      companyId: transaction.companyId,
      type: transaction.type,
      amount: walletAmountToString(transaction.amount),
      availableBefore: walletAmountToString(transaction.availableBefore),
      availableAfter: walletAmountToString(transaction.availableAfter),
      frozenBefore: walletAmountToString(transaction.frozenBefore),
      frozenAfter: walletAmountToString(transaction.frozenAfter),
      referenceType: transaction.referenceType,
      referenceId: transaction.referenceId,
      idempotencyKey: transaction.idempotencyKey,
      actorUserId: transaction.actorUserId,
      remark: transaction.remark,
      createdAt: transaction.createdAt,
    };
  }

  private async findExistingTransaction(idempotencyKey: string) {
    return this.prisma.walletTransaction.findUnique({
      where: { idempotencyKey },
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    );
  }

  toAccountResponse(account: WalletAccountRecord) {
    return {
      id: account.id,
      companyId: account.companyId,
      userId: account.userId,
      currency: account.currency,
      availableBalance: account.availableBalance,
      frozenBalance: account.frozenBalance,
      status: account.status,
      version: account.version,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  toTransactionResponse(transaction: WalletTransactionRecord) {
    return {
      id: transaction.id,
      walletAccountId: transaction.walletAccountId,
      companyId: transaction.companyId,
      type: transaction.type,
      amount: transaction.amount,
      availableBefore: transaction.availableBefore,
      availableAfter: transaction.availableAfter,
      frozenBefore: transaction.frozenBefore,
      frozenAfter: transaction.frozenAfter,
      referenceType: transaction.referenceType,
      referenceId: transaction.referenceId,
      idempotencyKey: transaction.idempotencyKey,
      actorUserId: transaction.actorUserId,
      remark: transaction.remark,
      createdAt: transaction.createdAt.toISOString(),
    };
  }

  toMutationResponse(result: {
    idempotent: boolean;
    account: WalletAccountRecord;
    transaction: WalletTransactionRecord;
  }) {
    return {
      idempotent: result.idempotent,
      account: this.toAccountResponse(result.account),
      transaction: this.toTransactionResponse(result.transaction),
    };
  }
}
