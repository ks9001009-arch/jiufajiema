import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

type TeamRecord = {
  id: string;
  name: string;
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId?: string) {
    return this.prisma.team.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
    });

    if (!team) {
      throw new NotFoundException(`Team with id "${id}" not found`);
    }

    return team;
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

    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        companyId: dto.companyId,
      },
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

    return team;
  }

  async update(id: string, dto: UpdateTeamDto, actorUserId: string) {
    const existingTeam = await this.prisma.team.findUnique({
      where: { id },
    });

    if (!existingTeam) {
      throw new NotFoundException(`Team with id "${id}" not found`);
    }

    const updatedTeam = await this.prisma.team.update({
      where: { id: existingTeam.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
      },
    });

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

    return updatedTeam;
  }

  private toAuditData(team: TeamRecord) {
    return {
      id: team.id,
      name: team.name,
      companyId: team.companyId,
      createdAt: team.createdAt.toISOString(),
      updatedAt: team.updatedAt.toISOString(),
    };
  }
}
