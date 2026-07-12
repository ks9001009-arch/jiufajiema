import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

type ServiceRecord = {
  id: string;
  companyId: string;
  name: string;
  code: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

const companySelect = {
  id: true,
  name: true,
  code: true,
} as const;

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId?: string) {
    return this.prisma.service.findMany({
      where: companyId ? { companyId } : undefined,
      include: { company: { select: companySelect } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { company: { select: companySelect } },
    });

    if (!service) {
      throw new NotFoundException(`Service with id "${id}" not found`);
    }

    return service;
  }

  async create(dto: CreateServiceDto, actorUserId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new NotFoundException(
        `Company with id "${dto.companyId}" not found`,
      );
    }

    try {
      const service = await this.prisma.service.create({
        data: {
          companyId: dto.companyId,
          name: dto.name,
          code: dto.code,
          description: dto.description || null,
        },
        include: { company: { select: companySelect } },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'service.create',
          targetType: 'Service',
          targetId: service.id,
          actorUserId,
          companyId: service.companyId,
          afterData: this.toAuditData(service),
        },
      });

      return service;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          `Service with code "${dto.code}" already exists in this company`,
        );
      }

      throw error;
    }
  }

  async update(id: string, dto: UpdateServiceDto, actorUserId: string) {
    const existing = await this.prisma.service.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Service with id "${id}" not found`);
    }

    try {
      const service = await this.prisma.service.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.code !== undefined ? { code: dto.code } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description || null }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include: { company: { select: companySelect } },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'service.update',
          targetType: 'Service',
          targetId: service.id,
          actorUserId,
          companyId: service.companyId,
          beforeData: this.toAuditData(existing),
          afterData: this.toAuditData(service),
        },
      });

      return service;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          `Service with code "${dto.code}" already exists in this company`,
        );
      }

      throw error;
    }
  }

  private toAuditData(service: ServiceRecord) {
    return {
      id: service.id,
      companyId: service.companyId,
      name: service.name,
      code: service.code,
      description: service.description,
      status: service.status,
      createdAt: service.createdAt.toISOString(),
      updatedAt: service.updatedAt.toISOString(),
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
