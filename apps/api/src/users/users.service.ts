import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const PENDING_PASSWORD_HASH = 'PENDING_AUTH_SETUP';

type UserRecord = {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string | null;
  status: string;
  companyId: string | null;
  teamId: string | null;
  roleId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId?: string, teamId?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(teamId ? { teamId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => this.toPublicUser(user));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    return this.toPublicUser(user);
  }

  async create(dto: CreateUserDto, actorUserId: string) {
    await this.validateCreateRelations(dto);

    try {
      const user = await this.prisma.user.create({
        data: {
          username: dto.username,
          passwordHash: await this.resolvePasswordHash(dto.password),
          displayName: dto.displayName,
          companyId: dto.companyId,
          teamId: dto.teamId,
          roleId: dto.roleId,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'user.create',
          targetType: 'User',
          targetId: user.id,
          actorUserId,
          companyId: user.companyId,
          afterData: this.toAuditData(user),
        },
      });

      return this.toPublicUser(user);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          `User with username "${dto.username}" already exists`,
        );
      }

      throw error;
    }
  }

  async update(id: string, dto: UpdateUserDto, actorUserId: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    await this.validateUpdateRelations(dto, existing);

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.teamId !== undefined ? { teamId: dto.teamId } : {}),
        ...(dto.roleId !== undefined ? { roleId: dto.roleId } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'user.update',
        targetType: 'User',
        targetId: user.id,
        actorUserId,
        companyId: user.companyId,
        beforeData: this.toAuditData(existing),
        afterData: this.toAuditData(user),
      },
    });

    return this.toPublicUser(user);
  }

  private async validateCreateRelations(dto: CreateUserDto) {
    if (dto.companyId) {
      await this.assertCompanyExists(dto.companyId);
    }

    let team: { id: string; companyId: string } | undefined;
    if (dto.teamId) {
      team = await this.assertTeamExists(dto.teamId);
    }

    if (dto.roleId) {
      await this.assertRoleExists(dto.roleId);
    }

    if (dto.companyId && dto.teamId && team) {
      this.assertTeamBelongsToCompany(team, dto.companyId);
    }
  }

  private async validateUpdateRelations(
    dto: UpdateUserDto,
    existing: UserRecord,
  ) {
    if (dto.teamId) {
      const team = await this.assertTeamExists(dto.teamId);

      if (existing.companyId) {
        this.assertTeamBelongsToCompany(team, existing.companyId);
      }
    }

    if (dto.roleId) {
      await this.assertRoleExists(dto.roleId);
    }
  }

  private async assertCompanyExists(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException(`Company with id "${companyId}" not found`);
    }
  }

  private async assertTeamExists(teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });

    if (!team) {
      throw new NotFoundException(`Team with id "${teamId}" not found`);
    }

    return team;
  }

  private async assertRoleExists(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });

    if (!role) {
      throw new NotFoundException(`Role with id "${roleId}" not found`);
    }
  }

  private assertTeamBelongsToCompany(
    team: { id: string; companyId: string },
    companyId: string,
  ) {
    if (team.companyId !== companyId) {
      throw new BadRequestException(
        `Team with id "${team.id}" does not belong to company with id "${companyId}"`,
      );
    }
  }

  private async resolvePasswordHash(password?: string) {
    if (password) {
      return bcrypt.hash(password, 10);
    }

    return PENDING_PASSWORD_HASH;
  }

  private toPublicUser(user: UserRecord) {
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
  }

  private toAuditData(user: UserRecord) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      status: user.status,
      companyId: user.companyId,
      teamId: user.teamId,
      roleId: user.roleId,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
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
