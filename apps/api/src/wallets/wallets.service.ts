import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  AdjustWalletAccountDto,
  CreateWalletAccountDto,
  ListWalletTransactionsQueryDto,
  RechargeWalletAccountDto,
} from './dto/wallet.dto';
import { WalletLedgerService } from './wallet-ledger.service';
import { walletAmountToString } from './wallet-decimal.util';

const companySelect = {
  id: true,
  name: true,
  code: true,
} as const;

const accountSelect = {
  id: true,
  companyId: true,
  userId: true,
  currency: true,
  availableBalance: true,
  frozenBalance: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  company: { select: companySelect },
} as const;

const transactionSelect = {
  id: true,
  walletAccountId: true,
  companyId: true,
  type: true,
  amount: true,
  availableBefore: true,
  availableAfter: true,
  frozenBefore: true,
  frozenAfter: true,
  referenceType: true,
  referenceId: true,
  idempotencyKey: true,
  actorUserId: true,
  remark: true,
  createdAt: true,
} as const;

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletLedgerService: WalletLedgerService,
  ) {}

  async findAll(companyId?: string) {
    const accounts = await this.prisma.walletAccount.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        userId: null,
      },
      select: accountSelect,
      orderBy: { createdAt: 'desc' },
    });

    return accounts.map((account) => this.toAccountResponse(account));
  }

  async findOne(id: string) {
    const account = await this.prisma.walletAccount.findUnique({
      where: { id },
      select: accountSelect,
    });

    if (!account) {
      throw new NotFoundException(`Wallet account with id "${id}" not found`);
    }

    return this.toAccountResponse(account);
  }

  async findTransactions(
    walletAccountId: string,
    query: ListWalletTransactionsQueryDto,
  ) {
    const account = await this.prisma.walletAccount.findUnique({
      where: { id: walletAccountId },
      select: { id: true },
    });

    if (!account) {
      throw new NotFoundException(
        `Wallet account with id "${walletAccountId}" not found`,
      );
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = { walletAccountId };

    const [items, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where,
        select: transactionSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return {
      items: items.map((item) =>
        this.walletLedgerService.toTransactionResponse({
          id: item.id,
          walletAccountId: item.walletAccountId,
          companyId: item.companyId,
          type: item.type,
          amount: walletAmountToString(item.amount),
          availableBefore: walletAmountToString(item.availableBefore),
          availableAfter: walletAmountToString(item.availableAfter),
          frozenBefore: walletAmountToString(item.frozenBefore),
          frozenAfter: walletAmountToString(item.frozenAfter),
          referenceType: item.referenceType,
          referenceId: item.referenceId,
          idempotencyKey: item.idempotencyKey,
          actorUserId: item.actorUserId,
          remark: item.remark,
          createdAt: item.createdAt,
        }),
      ),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async create(dto: CreateWalletAccountDto, actorUserId: string) {
    if (dto.userId) {
      throw new BadRequestException(
        'User wallet accounts are not supported in phase 1',
      );
    }

    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new NotFoundException(`Company with id "${dto.companyId}" not found`);
    }

    const existing = await this.prisma.walletAccount.findFirst({
      where: {
        companyId: dto.companyId,
        currency: dto.currency,
        userId: null,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        `Company wallet for currency "${dto.currency}" already exists`,
      );
    }

    try {
      const account = await this.prisma.walletAccount.create({
        data: {
          companyId: dto.companyId,
          userId: null,
          currency: dto.currency,
          availableBalance: 0,
          frozenBalance: 0,
        },
        select: accountSelect,
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'wallet.account.create',
          targetType: 'WalletAccount',
          targetId: account.id,
          actorUserId,
          companyId: account.companyId,
          afterData: this.toAccountResponse(account),
        },
      });

      return this.toAccountResponse(account);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          `Company wallet for currency "${dto.currency}" already exists`,
        );
      }

      throw error;
    }
  }

  async recharge(
    walletAccountId: string,
    dto: RechargeWalletAccountDto,
    actorUserId: string,
  ) {
    const result = await this.walletLedgerService.recharge({
      walletAccountId,
      amount: dto.amount,
      idempotencyKey: dto.idempotencyKey,
      actorUserId,
      remark: dto.remark,
    });

    return this.walletLedgerService.toMutationResponse(result);
  }

  async adjust(
    walletAccountId: string,
    dto: AdjustWalletAccountDto,
    actorUserId: string,
  ) {
    const params = {
      walletAccountId,
      amount: dto.amount,
      idempotencyKey: dto.idempotencyKey,
      actorUserId,
      remark: dto.remark,
    };

    const result =
      dto.direction === 'CREDIT'
        ? await this.walletLedgerService.manualCredit(params)
        : await this.walletLedgerService.manualDebit(params);

    return this.walletLedgerService.toMutationResponse(result);
  }

  private toAccountResponse(
    account: {
      id: string;
      companyId: string;
      userId: string | null;
      currency: string;
      availableBalance: { toString(): string };
      frozenBalance: { toString(): string };
      status: 'ACTIVE' | 'DISABLED';
      version: number;
      createdAt: Date;
      updatedAt: Date;
      company?: { id: string; name: string; code: string };
    },
  ) {
    const normalized = {
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

    return {
      ...this.walletLedgerService.toAccountResponse(normalized),
      ...(account.company ? { company: account.company } : {}),
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    );
  }
}
