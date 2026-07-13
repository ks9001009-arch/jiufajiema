import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreatePhoneResourceDto } from './dto/create-phone-resource.dto';
import { PhoneResourceStatus } from './dto/phone-resource.validation';
import { UpdatePhoneResourceDto } from './dto/update-phone-resource.dto';

type PhoneResourceRecord = {
  id: string;
  companyId: string;
  providerId: string;
  phone: string;
  country: string | null;
  status: string;
  cost: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
};

type PhoneResourceFilters = {
  companyId?: string;
  providerId?: string;
  status?: PhoneResourceStatus;
};

const companySelect = {
  id: true,
  name: true,
  code: true,
} as const;

const providerSelect = {
  id: true,
  companyId: true,
  name: true,
  code: true,
  status: true,
} as const;

const phoneResourceSelect = {
  id: true,
  companyId: true,
  providerId: true,
  phone: true,
  country: true,
  status: true,
  cost: true,
  createdAt: true,
  updatedAt: true,
  company: { select: companySelect },
  provider: { select: providerSelect },
} as const;

@Injectable()
export class PhoneResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: PhoneResourceFilters) {
    const resources = await this.prisma.phoneResource.findMany({
      where: {
        ...(filters.companyId ? { companyId: filters.companyId } : {}),
        ...(filters.providerId ? { providerId: filters.providerId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      select: phoneResourceSelect,
      orderBy: { createdAt: 'desc' },
    });

    return resources.map((resource) => this.toResponse(resource));
  }

  async findOne(id: string) {
    const resource = await this.prisma.phoneResource.findUnique({
      where: { id },
      select: phoneResourceSelect,
    });

    if (!resource) {
      throw new NotFoundException(`PhoneResource with id "${id}" not found`);
    }

    return this.toResponse(resource);
  }

  async create(dto: CreatePhoneResourceDto, actorUserId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new NotFoundException(
        `Company with id "${dto.companyId}" not found`,
      );
    }

    await this.validateProvider(dto.providerId, dto.companyId);

    try {
      const resource = await this.prisma.phoneResource.create({
        data: {
          companyId: dto.companyId,
          providerId: dto.providerId,
          phone: dto.phone,
          country: dto.country || null,
          cost: dto.cost,
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        select: phoneResourceSelect,
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'phoneResource.create',
          targetType: 'PhoneResource',
          targetId: resource.id,
          actorUserId,
          companyId: resource.companyId,
          afterData: this.toAuditData(resource),
        },
      });

      return this.toResponse(resource);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          `Phone "${dto.phone}" already exists in this company`,
        );
      }

      throw error;
    }
  }

  async update(id: string, dto: UpdatePhoneResourceDto, actorUserId: string) {
    const existing = await this.prisma.phoneResource.findUnique({
      where: { id },
      select: phoneResourceSelect,
    });

    if (!existing) {
      throw new NotFoundException(`PhoneResource with id "${id}" not found`);
    }

    if (dto.providerId !== undefined) {
      await this.validateProvider(dto.providerId, existing.companyId);
    }

    try {
      const resource = await this.prisma.phoneResource.update({
        where: { id },
        data: {
          ...(dto.providerId !== undefined
            ? { providerId: dto.providerId }
            : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.country !== undefined
            ? { country: dto.country || null }
            : {}),
          ...(dto.cost !== undefined ? { cost: dto.cost } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        select: phoneResourceSelect,
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'phoneResource.update',
          targetType: 'PhoneResource',
          targetId: resource.id,
          actorUserId,
          companyId: resource.companyId,
          beforeData: this.toAuditData(existing),
          afterData: this.toAuditData(resource),
        },
      });

      return this.toResponse(resource);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          `Phone "${dto.phone}" already exists in this company`,
        );
      }

      throw error;
    }
  }

  private async validateProvider(providerId: string, companyId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { id: true, companyId: true },
    });

    if (!provider) {
      throw new NotFoundException(`Provider with id "${providerId}" not found`);
    }

    if (provider.companyId !== companyId) {
      throw new BadRequestException(
        'Provider must belong to the phone resource company',
      );
    }
  }

  private toResponse<T extends PhoneResourceRecord>(resource: T) {
    return {
      ...resource,
      cost: resource.cost.toString(),
    };
  }

  private toAuditData(resource: PhoneResourceRecord) {
    return {
      id: resource.id,
      companyId: resource.companyId,
      providerId: resource.providerId,
      phone: resource.phone,
      country: resource.country,
      status: resource.status,
      cost: resource.cost.toString(),
      createdAt: resource.createdAt.toISOString(),
      updatedAt: resource.updatedAt.toISOString(),
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
