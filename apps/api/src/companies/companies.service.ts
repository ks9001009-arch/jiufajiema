import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CountryAccessService } from '../country-access/country-access.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly countryAccessService: CountryAccessService,
  ) {}

  async findAll() {
    const companies = await this.prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(companies.map((company) => this.withCountryCodes(company)));
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });

    if (!company) {
      throw new NotFoundException(`Company with id "${id}" not found`);
    }

    return this.withCountryCodes(company);
  }

  async create(dto: CreateCompanyDto, actorUserId: string) {
    const normalizedCountryCodes =
      dto.countryCodes !== undefined
        ? await this.countryAccessService.validateCountryCodes(dto.countryCodes)
        : [];

    try {
      const company = await this.prisma.$transaction(async (tx) => {
        const created = await tx.company.create({
          data: {
            name: dto.name,
            code: dto.code,
          },
        });

        if (normalizedCountryCodes.length > 0) {
          await tx.companyCountry.createMany({
            data: normalizedCountryCodes.map((countryCode) => ({
              companyId: created.id,
              countryCode,
            })),
          });
        }

        return created;
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'company.create',
          targetType: 'Company',
          targetId: company.id,
          actorUserId,
          companyId: company.id,
          afterData: {
            ...this.toAuditData(company),
            countryCodes: normalizedCountryCodes,
          },
        },
      });

      if (dto.countryCodes !== undefined) {
        await this.prisma.auditLog.create({
          data: {
            action: 'company.country.update',
            targetType: 'Company',
            targetId: company.id,
            actorUserId,
            companyId: company.id,
            beforeData: { countryCodes: [] },
            afterData: { countryCodes: normalizedCountryCodes },
          },
        });
      }

      return this.withCountryCodes(company);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          `Company with code "${dto.code}" already exists`,
        );
      }

      throw error;
    }
  }

  async update(id: string, dto: UpdateCompanyDto, actorUserId: string) {
    const existing = await this.prisma.company.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Company with id "${id}" not found`);
    }

    const beforeCountryCodes =
      await this.countryAccessService.getCompanyAllowedCountries(id);

    const company = await this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    let afterCountryCodes = beforeCountryCodes;

    if (dto.countryCodes !== undefined) {
      afterCountryCodes = await this.countryAccessService.validateCountryCodes(
        dto.countryCodes,
      );

      await this.prisma.$transaction(async (tx) => {
        await tx.companyCountry.deleteMany({ where: { companyId: id } });

        if (afterCountryCodes.length > 0) {
          await tx.companyCountry.createMany({
            data: afterCountryCodes.map((countryCode) => ({
              companyId: id,
              countryCode,
            })),
          });
        }
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'company.country.update',
          targetType: 'Company',
          targetId: company.id,
          actorUserId,
          companyId: company.id,
          beforeData: { countryCodes: beforeCountryCodes },
          afterData: { countryCodes: afterCountryCodes },
        },
      });
    }

    if (dto.name !== undefined || dto.status !== undefined) {
      await this.prisma.auditLog.create({
        data: {
          action: 'company.update',
          targetType: 'Company',
          targetId: company.id,
          actorUserId,
          companyId: company.id,
          beforeData: this.toAuditData(existing),
          afterData: this.toAuditData(company),
        },
      });
    }

    return {
      ...company,
      countryCodes: afterCountryCodes,
    };
  }

  private async withCountryCodes(company: CompanyRecord) {
    const countryCodes =
      await this.countryAccessService.getCompanyAllowedCountries(company.id);

    return {
      ...company,
      countryCodes,
    };
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
