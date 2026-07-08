import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

type RoleRecord = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.role.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });

    if (!role) {
      throw new NotFoundException(`Role with id "${id}" not found`);
    }

    return role;
  }

  async create(dto: CreateRoleDto, actorUserId: string) {
    try {
      const role = await this.prisma.role.create({
        data: {
          name: dto.name,
          code: dto.code,
          description: dto.description,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'role.create',
          targetType: 'Role',
          targetId: role.id,
          actorUserId,
          afterData: this.toAuditData(role),
        },
      });

      return role;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          `Role with code "${dto.code}" already exists`,
        );
      }

      throw error;
    }
  }

  async update(id: string, dto: UpdateRoleDto, actorUserId: string) {
    const existing = await this.prisma.role.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Role with id "${id}" not found`);
    }

    const role = await this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'role.update',
        targetType: 'Role',
        targetId: role.id,
        actorUserId,
        beforeData: this.toAuditData(existing),
        afterData: this.toAuditData(role),
      },
    });

    return role;
  }

  private toAuditData(role: RoleRecord) {
    return {
      id: role.id,
      name: role.name,
      code: role.code,
      description: role.description,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
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
