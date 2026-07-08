import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

type CompanyRecord = {
  id: string;
  name: string;
  code: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });

    if (!company) {
      throw new NotFoundException(`Company with id "${id}" not found`);
    }

    return company;
  }

  async create(dto: CreateCompanyDto) {
    try {
      const company = await this.prisma.company.create({
        data: {
          name: dto.name,
          code: dto.code,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'company.create',
          targetType: 'Company',
          targetId: company.id,
          companyId: company.id,
          afterData: this.toAuditData(company),
        },
      });

      return company;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          `Company with code "${dto.code}" already exists`,
        );
      }

      throw error;
    }
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const existing = await this.prisma.company.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Company with id "${id}" not found`);
    }

    const company = await this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'company.update',
        targetType: 'Company',
        targetId: company.id,
        companyId: company.id,
        beforeData: this.toAuditData(existing),
        afterData: this.toAuditData(company),
      },
    });

    return company;
  }

  private toAuditData(company: CompanyRecord) {
    return {
      id: company.id,
      name: company.name,
      code: company.code,
      status: company.status,
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
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
