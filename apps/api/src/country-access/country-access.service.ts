import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CountryAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompanyAllowedCountries(companyId: string) {
    const rows = await this.prisma.companyCountry.findMany({
      where: {
        companyId,
        country: { enabled: true },
      },
      select: { countryCode: true },
      orderBy: [{ country: { sortOrder: 'asc' } }, { countryCode: 'asc' }],
    });

    return rows.map((row) => row.countryCode);
  }

  async getTeamEffectiveCountries(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        companyId: true,
        countryPolicyMode: true,
        countryPolicies: {
          select: { countryCode: true },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team with id "${teamId}" not found`);
    }

    const companyAllowed = await this.getCompanyAllowedCountries(team.companyId);
    const companyAllowedSet = new Set(companyAllowed);

    if (team.countryPolicyMode === 'INHERIT') {
      return companyAllowed;
    }

    return team.countryPolicies
      .map((item) => item.countryCode)
      .filter((code) => companyAllowedSet.has(code))
      .sort();
  }

  async resolveEffectiveCountries(
    companyId: string,
    teamId?: string | null,
  ) {
    const companyAllowed = await this.getCompanyAllowedCountries(companyId);

    if (!teamId) {
      return companyAllowed;
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, companyId: true },
    });

    if (!team) {
      throw new NotFoundException(`Team with id "${teamId}" not found`);
    }

    if (team.companyId !== companyId) {
      throw new BadRequestException('Team must belong to the order company');
    }

    return this.getTeamEffectiveCountries(teamId);
  }

  async assertCountryAllowed(
    companyId: string,
    teamId: string | null | undefined,
    countryCode: string,
  ) {
    const normalized = countryCode.trim().toUpperCase();
    const effective = await this.resolveEffectiveCountries(companyId, teamId);

    if (effective.length === 0) {
      throw new BadRequestException(
        'Company has no allowed countries configured',
      );
    }

    if (!effective.includes(normalized)) {
      throw new BadRequestException(
        `Country "${normalized}" is not allowed for this company or team`,
      );
    }
  }

  async validateCountryCodes(codes: string[]) {
    const normalized = [...new Set(codes.map((code) => code.trim().toUpperCase()))];

    if (normalized.length === 0) {
      return normalized;
    }

    const countries = await this.prisma.country.findMany({
      where: {
        code: { in: normalized },
        enabled: true,
      },
      select: { code: true },
    });

    if (countries.length !== normalized.length) {
      throw new BadRequestException(
        'One or more country codes are invalid or disabled',
      );
    }

    return normalized.sort();
  }

  async assertTeamCountrySubset(companyId: string, countryCodes: string[]) {
    const normalized = await this.validateCountryCodes(countryCodes);
    const companyAllowed = await this.getCompanyAllowedCountries(companyId);
    const companyAllowedSet = new Set(companyAllowed);

    const invalid = normalized.filter((code) => !companyAllowedSet.has(code));

    if (invalid.length > 0) {
      throw new BadRequestException(
        'Team countries must be a subset of company allowed countries',
      );
    }

    return normalized;
  }
}
