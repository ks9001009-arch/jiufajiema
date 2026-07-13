import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';

type ProviderAuditRecord = {
  id: string;
  companyId: string;
  name: string;
  code: string;
  adapter: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  services: Array<{ id: string }>;
};

const companySelect = {
  id: true,
  name: true,
  code: true,
} as const;

const serviceSelect = {
  id: true,
  companyId: true,
  name: true,
  code: true,
} as const;

const providerSelect = {
  id: true,
  companyId: true,
  name: true,
  code: true,
  adapter: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  company: { select: companySelect },
  services: { select: serviceSelect },
} as const;

@Injectable()
export class ProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId?: string) {
    return this.prisma.provider.findMany({
      where: companyId ? { companyId } : undefined,
      select: providerSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id },
      select: providerSelect,
    });

    if (!provider) {
      throw new NotFoundException(`Provider with id "${id}" not found`);
    }

    return provider;
  }

  async create(dto: CreateProviderDto, actorUserId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new NotFoundException(
        `Company with id "${dto.companyId}" not found`,
      );
    }

    await this.validateServices(dto.serviceIds, dto.companyId);

    try {
      const provider = await this.prisma.provider.create({
        data: {
          companyId: dto.companyId,
          name: dto.name,
          code: dto.code,
          adapter: dto.adapter,
          ...(dto.serviceIds !== undefined
            ? {
                services: {
                  connect: dto.serviceIds.map((id) => ({ id })),
                },
              }
            : {}),
        },
        select: providerSelect,
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'provider.create',
          targetType: 'Provider',
          targetId: provider.id,
          actorUserId,
          companyId: provider.companyId,
          afterData: this.toAuditData(provider),
        },
      });

      return provider;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          `Provider with code "${dto.code}" already exists in this company`,
        );
      }

      throw error;
    }
  }

  async update(id: string, dto: UpdateProviderDto, actorUserId: string) {
    const existing = await this.prisma.provider.findUnique({
      where: { id },
      select: providerSelect,
    });

    if (!existing) {
      throw new NotFoundException(`Provider with id "${id}" not found`);
    }

    await this.validateServices(dto.serviceIds, existing.companyId);

    try {
      const provider = await this.prisma.provider.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.code !== undefined ? { code: dto.code } : {}),
          ...(dto.adapter !== undefined ? { adapter: dto.adapter } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.serviceIds !== undefined
            ? {
                services: {
                  set: dto.serviceIds.map((serviceId) => ({ id: serviceId })),
                },
              }
            : {}),
        },
        select: providerSelect,
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'provider.update',
          targetType: 'Provider',
          targetId: provider.id,
          actorUserId,
          companyId: provider.companyId,
          beforeData: this.toAuditData(existing),
          afterData: this.toAuditData(provider),
        },
      });

      return provider;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          `Provider with code "${dto.code}" already exists in this company`,
        );
      }

      throw error;
    }
  }

  private async validateServices(
    serviceIds: string[] | undefined,
    companyId: string,
  ) {
    if (serviceIds === undefined || serviceIds.length === 0) {
      return;
    }

    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, companyId: true },
    });

    if (services.length !== serviceIds.length) {
      throw new NotFoundException('One or more services were not found');
    }

    if (services.some((service) => service.companyId !== companyId)) {
      throw new BadRequestException(
        'All services must belong to the provider company',
      );
    }
  }

  private toAuditData(provider: ProviderAuditRecord) {
    return {
      id: provider.id,
      companyId: provider.companyId,
      name: provider.name,
      code: provider.code,
      adapter: provider.adapter,
      status: provider.status,
      serviceIds: provider.services.map((service) => service.id),
      createdAt: provider.createdAt.toISOString(),
      updatedAt: provider.updatedAt.toISOString(),
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
