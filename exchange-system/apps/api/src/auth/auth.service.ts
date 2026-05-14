import {
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcryptjs';
import { Redis } from 'ioredis';
import { AuthTokenPayload, AuthResponse } from '@exchange/shared';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async login(dto: LoginDto, ip?: string, userAgent?: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: AuthTokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role as AuthTokenPayload['role'],
    };

    const accessToken = this.jwtService.sign(payload);

    await this.auditService.log({
      userId: user.id,
      action: 'LOGIN',
      ipAddress: ip,
      userAgent,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role as AuthTokenPayload['role'],
        isActive: user.isActive,
      },
    };
  }

  async logout(token: string, userId: string): Promise<void> {
    // Decode to get expiry, then blacklist until expiry
    const decoded = this.jwtService.decode(token) as { exp?: number };
    const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
    if (ttl > 0) {
      await this.redis.setex(`bl:${token}`, ttl, '1');
    }

    await this.auditService.log({ userId, action: 'LOGOUT' });
  }
}
