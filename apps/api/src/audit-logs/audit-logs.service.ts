import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters: {
    companyId?: string;
    actorUserId?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    limit?: string;
  }) {
    const limit = this.parseLimit(filters.limit);

    return this.prisma.auditLog.findMany({
      where: {
        ...(filters.companyId ? { companyId: filters.companyId } : {}),
        ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.targetType ? { targetType: filters.targetType } : {}),
        ...(filters.targetId ? { targetId: filters.targetId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findOne(id: string) {
    const auditLog = await this.prisma.auditLog.findUnique({ where: { id } });

    if (!auditLog) {
      throw new NotFoundException(`AuditLog with id "${id}" not found`);
    }

    return auditLog;
  }

  private parseLimit(limit?: string): number {
    if (!limit) {
      return DEFAULT_LIMIT;
    }

    const parsed = Number.parseInt(limit, 10);

    if (Number.isNaN(parsed) || parsed < 1) {
      return DEFAULT_LIMIT;
    }

    return Math.min(parsed, MAX_LIMIT);
  }
}
