import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';

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
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }

    if (user.passwordHash === PENDING_PASSWORD_HASH) {
      throw new UnauthorizedException();
    }

    const passwordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException();
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      username: user.username,
      companyId: user.companyId,
      teamId: user.teamId,
      roleId: user.roleId,
    });

    return {
      accessToken,
      user: this.toAuthUser(user),
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.toAuthUser(user);
  }

  private toAuthUser(user: UserRecord) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      status: user.status,
      companyId: user.companyId,
      teamId: user.teamId,
      roleId: user.roleId,
    };
  }
}
