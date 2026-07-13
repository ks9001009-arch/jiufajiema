import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  type OrderStatus,
  type TerminalOrderStatus,
} from './dto/order.validation';

type OrderRecord = {
  id: string;
  companyId: string;
  userId: string | null;
  serviceId: string;
  providerId: string;
  phoneResourceId: string;
  status: string;
  amount: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
};

type OrderFilters = {
  companyId?: string;
  status?: OrderStatus;
  serviceId?: string;
  providerId?: string;
  phoneResourceId?: string;
  userId?: string;
  phone?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  pageSize?: number;
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
  status: true,
} as const;

const phoneResourceSelect = {
  id: true,
  companyId: true,
  providerId: true,
  phone: true,
  country: true,
  status: true,
} as const;

const userSelect = {
  id: true,
  username: true,
  displayName: true,
} as const;

const orderSelect = {
  id: true,
  companyId: true,
  userId: true,
  serviceId: true,
  providerId: true,
  phoneResourceId: true,
  status: true,
  amount: true,
  createdAt: true,
  updatedAt: true,
  company: { select: companySelect },
  service: { select: serviceSelect },
  provider: { select: providerSelect },
  phoneResource: { select: phoneResourceSelect },
  user: { select: userSelect },
} as const;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListOrdersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildListWhere(query);

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: orderSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return {
      items: orders.map((order) => this.toResponse(order)),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  private buildListWhere(filters: OrderFilters) {
    const createdAt =
      filters.createdFrom || filters.createdTo
        ? {
            ...(filters.createdFrom
              ? { gte: new Date(filters.createdFrom) }
              : {}),
            ...(filters.createdTo ? { lte: new Date(filters.createdTo) } : {}),
          }
        : undefined;

    return {
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
      ...(filters.providerId ? { providerId: filters.providerId } : {}),
      ...(filters.phoneResourceId
        ? { phoneResourceId: filters.phoneResourceId }
        : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.phone
        ? {
            phoneResource: {
              phone: { contains: filters.phone.trim() },
            },
          }
        : {}),
      ...(createdAt ? { createdAt } : {}),
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: orderSelect,
    });

    if (!order) {
      throw new NotFoundException(`Order with id "${id}" not found`);
    }

    return this.toResponse(order);
  }

  async create(dto: CreateOrderDto, actorUserId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new NotFoundException(
        `Company with id "${dto.companyId}" not found`,
      );
    }

    await this.validateCreateRelations(dto);

    const order = await this.prisma.$transaction(async (tx) => {
      const lockResult = await tx.phoneResource.updateMany({
        where: {
          id: dto.phoneResourceId,
          status: 'AVAILABLE',
        },
        data: {
          status: 'LOCKED',
        },
      });

      if (lockResult.count !== 1) {
        throw new ConflictException(
          'Phone resource is not available for locking',
        );
      }

      return tx.order.create({
        data: {
          companyId: dto.companyId,
          userId: dto.userId || null,
          serviceId: dto.serviceId,
          providerId: dto.providerId,
          phoneResourceId: dto.phoneResourceId,
          status: 'WAIT_SMS',
          amount: dto.amount,
        },
        select: orderSelect,
      });
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'order.create',
        targetType: 'Order',
        targetId: order.id,
        actorUserId,
        companyId: order.companyId,
        afterData: this.toAuditData(order),
      },
    });

    return this.toResponse(order);
  }

  async updateStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    actorUserId: string,
  ) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
      select: orderSelect,
    });

    if (!existing) {
      throw new NotFoundException(`Order with id "${id}" not found`);
    }

    if (dto.status === 'SUCCESS' && existing.status === 'SUCCESS') {
      throw new ConflictException('Order is already successful');
    }

    if (existing.status !== 'WAIT_SMS') {
      throw new BadRequestException(
        'Only orders in WAIT_SMS status can be updated',
      );
    }

    const auditAction =
      dto.status === 'SUCCESS' ? 'order.force_success' : 'order.status';

    const nextPhoneStatus = this.resolvePhoneStatus(dto.status);

    const order = await this.prisma.$transaction(async (tx) => {
      const phoneUpdate = await tx.phoneResource.updateMany({
        where: {
          id: existing.phoneResourceId,
          status: 'LOCKED',
        },
        data: {
          status: nextPhoneStatus,
        },
      });

      if (phoneUpdate.count !== 1) {
        throw new ConflictException(
          'Phone resource is not locked by this order',
        );
      }

      return tx.order.update({
        where: { id },
        data: {
          status: dto.status,
        },
        select: orderSelect,
      });
    });

    await this.prisma.auditLog.create({
      data: {
        action: auditAction,
        targetType: 'Order',
        targetId: order.id,
        actorUserId,
        companyId: order.companyId,
        beforeData: { status: existing.status },
        afterData: { status: order.status },
      },
    });

    return this.toResponse(order);
  }

  private async validateCreateRelations(dto: CreateOrderDto) {
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
      select: { id: true, companyId: true },
    });

    if (!service) {
      throw new NotFoundException(`Service with id "${dto.serviceId}" not found`);
    }

    if (service.companyId !== dto.companyId) {
      throw new BadRequestException(
        'Service must belong to the order company',
      );
    }

    const provider = await this.prisma.provider.findUnique({
      where: { id: dto.providerId },
      select: {
        id: true,
        companyId: true,
        services: { select: { id: true } },
      },
    });

    if (!provider) {
      throw new NotFoundException(
        `Provider with id "${dto.providerId}" not found`,
      );
    }

    if (provider.companyId !== dto.companyId) {
      throw new BadRequestException(
        'Provider must belong to the order company',
      );
    }

    const supportsService = provider.services.some(
      (item) => item.id === dto.serviceId,
    );

    if (!supportsService) {
      throw new BadRequestException('Provider does not support this service');
    }

    const phoneResource = await this.prisma.phoneResource.findUnique({
      where: { id: dto.phoneResourceId },
      select: {
        id: true,
        companyId: true,
        providerId: true,
        status: true,
      },
    });

    if (!phoneResource) {
      throw new NotFoundException(
        `PhoneResource with id "${dto.phoneResourceId}" not found`,
      );
    }

    if (phoneResource.companyId !== dto.companyId) {
      throw new BadRequestException(
        'PhoneResource must belong to the order company',
      );
    }

    if (phoneResource.providerId !== dto.providerId) {
      throw new BadRequestException(
        'PhoneResource must belong to the selected provider',
      );
    }

    if (phoneResource.status !== 'AVAILABLE') {
      throw new ConflictException('Phone resource is not available');
    }

    if (dto.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
        select: { id: true, companyId: true },
      });

      if (!user) {
        throw new NotFoundException(`User with id "${dto.userId}" not found`);
      }

      if (user.companyId !== dto.companyId) {
        throw new BadRequestException('User must belong to the order company');
      }
    }
  }

  private resolvePhoneStatus(status: TerminalOrderStatus) {
    if (status === 'SUCCESS') {
      return 'USED' as const;
    }

    return 'AVAILABLE' as const;
  }

  private toResponse<T extends OrderRecord>(order: T) {
    return {
      ...order,
      amount: order.amount.toString(),
    };
  }

  private toAuditData(order: OrderRecord) {
    return {
      id: order.id,
      companyId: order.companyId,
      userId: order.userId,
      serviceId: order.serviceId,
      providerId: order.providerId,
      phoneResourceId: order.phoneResourceId,
      status: order.status,
      amount: order.amount.toString(),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }
}
