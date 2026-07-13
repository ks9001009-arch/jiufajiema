import { Injectable, NotFoundException } from '@nestjs/common';
import { CountryAccessService } from '../country-access/country-access.service';
import { PrismaService } from '../database/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

type TeamRecord = {
  id: string;
  name: string;
  companyId: string;
  countryPolicyMode: 'INHERIT' | 'ALLOW_LIST';
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly countryAccessService: CountryAccessService,
  ) {}

  async findAll(companyId?: string) {
    const teams = await this.prisma.team.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(teams.map((team) => this.withCountryPolicy(team)));
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({ where: { id } });

    if (!team) {
      throw new NotFoundException(`Team with id "${id}" not found`);
    }

    return this.withCountryPolicy(team);
  }

  async create(dto: CreateTeamDto, actorUserId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new NotFoundException(
        `Company with id "${dto.companyId}" not found`,
      );
    }

    const policyMode = dto.countryPolicyMode ?? 'INHERIT';
    const countryCodes =
      policyMode === 'ALLOW_LIST' && dto.countryCodes
        ? await this.countryAccessService.assertTeamCountrySubset(
            dto.companyId,
            dto.countryCodes,
          )
        : [];

    const team = await this.prisma.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: {
          name: dto.name,
          companyId: dto.companyId,
          countryPolicyMode: policyMode,
        },
      });

      if (policyMode === 'ALLOW_LIST' && countryCodes.length > 0) {
        await tx.teamCountry.createMany({
          data: countryCodes.map((countryCode) => ({
            teamId: created.id,
            countryCode,
          })),
        });
      }

      return created;
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'team.create',
        targetType: 'Team',
        targetId: team.id,
        actorUserId,
        companyId: team.companyId,
        afterData: this.toAuditData(team),
      },
    });

    if (dto.countryPolicyMode !== undefined || dto.countryCodes !== undefined) {
      await this.writeCountryPolicyAudit(team.id, team.companyId, actorUserId, {
        countryPolicyMode: 'INHERIT',
        countryCodes: [],
      }, {
        countryPolicyMode: policyMode,
        countryCodes,
      });
    }

    return this.withCountryPolicy(team);
  }

  async update(id: string, dto: UpdateTeamDto, actorUserId: string) {
    const existingTeam = await this.prisma.team.findUnique({ where: { id } });

    if (!existingTeam) {
      throw new NotFoundException(`Team with id "${id}" not found`);
    }

    const beforePolicy = await this.getCountryPolicySnapshot(existingTeam.id);
    const nextPolicyMode = dto.countryPolicyMode ?? existingTeam.countryPolicyMode;

    let nextCountryCodes = beforePolicy.countryCodes;

    if (nextPolicyMode === 'INHERIT') {
      nextCountryCodes = [];
    } else if (dto.countryCodes !== undefined) {
      nextCountryCodes = await this.countryAccessService.assertTeamCountrySubset(
        existingTeam.companyId,
        dto.countryCodes,
      );
    }

    const updatedTeam = await this.prisma.$transaction(async (tx) => {
      const team = await tx.team.update({
        where: { id: existingTeam.id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.countryPolicyMode !== undefined
            ? { countryPolicyMode: dto.countryPolicyMode }
            : {}),
        },
      });

      if (
        dto.countryPolicyMode !== undefined ||
        dto.countryCodes !== undefined
      ) {
        await tx.teamCountry.deleteMany({ where: { teamId: id } });

        if (nextPolicyMode === 'ALLOW_LIST' && nextCountryCodes.length > 0) {
          await tx.teamCountry.createMany({
            data: nextCountryCodes.map((countryCode) => ({
              teamId: id,
              countryCode,
            })),
          });
        }
      }

      return team;
    });

    if (dto.name !== undefined) {
      await this.prisma.auditLog.create({
        data: {
          action: 'team.update',
          targetType: 'Team',
          targetId: updatedTeam.id,
          actorUserId,
          companyId: existingTeam.companyId,
          beforeData: this.toAuditData(existingTeam),
          afterData: this.toAuditData(updatedTeam),
        },
      });
    }

    if (dto.countryPolicyMode !== undefined || dto.countryCodes !== undefined) {
      await this.writeCountryPolicyAudit(
        updatedTeam.id,
        existingTeam.companyId,
        actorUserId,
        beforePolicy,
        {
          countryPolicyMode: nextPolicyMode,
          countryCodes: nextCountryCodes,
        },
      );
    }

    return this.withCountryPolicy(updatedTeam);
  }

  private async withCountryPolicy(team: TeamRecord) {
    const snapshot = await this.getCountryPolicySnapshot(team.id);

    return {
      ...team,
      countryPolicyMode: snapshot.countryPolicyMode,
      countryCodes: snapshot.countryCodes,
    };
  }

  private async getCountryPolicySnapshot(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        countryPolicyMode: true,
        countryPolicies: { select: { countryCode: true } },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team with id "${teamId}" not found`);
    }

    return {
      countryPolicyMode: team.countryPolicyMode,
      countryCodes:
        team.countryPolicyMode === 'ALLOW_LIST'
          ? team.countryPolicies.map((item) => item.countryCode).sort()
          : [],
    };
  }

  private async writeCountryPolicyAudit(
    teamId: string,
    companyId: string,
    actorUserId: string,
    beforeData: {
      countryPolicyMode: 'INHERIT' | 'ALLOW_LIST';
      countryCodes: string[];
    },
    afterData: {
      countryPolicyMode: 'INHERIT' | 'ALLOW_LIST';
      countryCodes: string[];
    },
  ) {
    await this.prisma.auditLog.create({
      data: {
        action: 'team.countryPolicy.update',
        targetType: 'Team',
        targetId: teamId,
        actorUserId,
        companyId,
        beforeData,
        afterData,
      },
    });
  }

  private toAuditData(team: TeamRecord) {
    return {
      id: team.id,
      name: team.name,
      companyId: team.companyId,
      countryPolicyMode: team.countryPolicyMode,
      createdAt: team.createdAt.toISOString(),
      updatedAt: team.updatedAt.toISOString(),
    };
  }
}
