import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllEnabled() {
    return this.prisma.country.findMany({
      where: { enabled: true },
      select: {
        code: true,
        nameZh: true,
        nameEn: true,
        emoji: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }
}
