import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { getBusinessDayRangeUtc } from './business-timezone.util';

const RECENT_AUDIT_LOG_LIMIT = 8;

const auditLogSummarySelect = {
  id: true,
  action: true,
  targetType: true,
  targetId: true,
  createdAt: true,
  actorUser: {
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  },
  company: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const { start: todayStart, end: todayEnd } = getBusinessDayRangeUtc();
    const todayCreatedAtRange = {
      gte: todayStart,
      lt: todayEnd,
    };

    const [
      companyCount,
      teamCount,
      userCount,
      roleCount,
      serviceCount,
      providerCount,
      availablePhoneCount,
      todayOrderCount,
      waitingSmsOrderCount,
      successOrderCount,
      failedOrderCount,
      todaySmsCount,
      recentAuditLogs,
    ] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.team.count(),
      this.prisma.user.count(),
      this.prisma.role.count(),
      this.prisma.service.count(),
      this.prisma.provider.count(),
      this.prisma.phoneResource.count({ where: { status: 'AVAILABLE' } }),
      this.prisma.order.count({
        where: { createdAt: todayCreatedAtRange },
      }),
      this.prisma.order.count({ where: { status: 'WAIT_SMS' } }),
      this.prisma.order.count({ where: { status: 'SUCCESS' } }),
      this.prisma.order.count({ where: { status: 'FAILED' } }),
      this.prisma.sms.count({
        where: { createdAt: todayCreatedAtRange },
      }),
      this.prisma.auditLog.findMany({
        select: auditLogSummarySelect,
        orderBy: { createdAt: 'desc' },
        take: RECENT_AUDIT_LOG_LIMIT,
      }),
    ]);

    return {
      companyCount,
      teamCount,
      userCount,
      roleCount,
      serviceCount,
      providerCount,
      availablePhoneCount,
      todayOrderCount,
      waitingSmsOrderCount,
      successOrderCount,
      failedOrderCount,
      todaySmsCount,
      recentAuditLogs: recentAuditLogs.map((log) => this.toAuditLogSummary(log)),
    };
  }

  private toAuditLogSummary<T extends { createdAt: Date }>(log: T) {
    return {
      ...log,
      createdAt: log.createdAt.toISOString(),
    };
  }
}
